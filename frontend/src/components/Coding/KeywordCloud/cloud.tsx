import { useState, useEffect, useRef, FC } from 'react';
import { IKeywordBox } from '../../../types/Coding/shared';
import { KeywordCloudProps } from '../../../types/Coding/props';
import { FiEdit, FiTrash2 } from 'react-icons/fi';
import UndoNotification from '../../Shared/undo-toast';
import { toast } from 'react-toastify';

const MAIN_TOPIC_FONT_SIZE = 20;
const OTHER_KEYWORD_FONT_SIZE = 14;
const PADDING_BETWEEN_WORDS = 10;
const EDGE_PADDING = 10; // Minimal padding from the edge of the circle
const RADIUS_STEP = 5; // Step to move inward if no spot is found
const ANGLE_OFFSETS = [0, -5, 5, -10, 10, -15, 15].map((deg) => (deg * Math.PI) / 180);

// Helper: measure text width using a temporary canvas.
function measureTextWidth(text: string, fontSize: number): number {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.font = `${fontSize}px Arial`;
        return ctx.measureText(text).width;
    }
    return 50;
}

// Simple collision detection between two keyword boxes (with extra padding)
function areKeywordsColliding(
    a: IKeywordBox,
    b: IKeywordBox,
    padding: number = PADDING_BETWEEN_WORDS
): boolean {
    return !(
        a.x + a.width + padding < b.x ||
        a.x > b.x + b.width + padding ||
        a.y + a.height + padding < b.y ||
        a.y > b.y + b.height + padding
    );
}

// Helper: Given an array, interleave its elements from the beginning and end.
function interleaveArray<T>(arr: T[]): T[] {
    const result: T[] = [];
    let left = 0;
    let right = arr.length - 1;
    while (left <= right) {
        if (left === right) {
            result.push(arr[left]);
        } else {
            result.push(arr[left]);
            result.push(arr[right]);
        }
        left++;
        right--;
    }
    return result;
}

interface DraggingKeyword {
    text: string;
    startX: number;
    startY: number;
    mouseStartX: number;
    mouseStartY: number;
    width: number;
    height: number;
}

const KeywordCloud: FC<KeywordCloudProps> = ({
    mainTopic,
    keywords,
    selectedKeywords,
    toggleKeywordSelection,
    setKeywords
}) => {
    console.log(selectedKeywords, 'wordcloud');
    const svgRef = useRef<SVGSVGElement | null>(null);
    // State for keyword placement (includes rotation if needed)
    const [placedKeywords, setPlacedKeywords] = useState<(IKeywordBox & { rotation: number })[]>(
        []
    );
    const [radius, setRadius] = useState<number>(0);

    // States for editing functionality
    const [editingWord, setEditingWord] = useState<string | null>(null);
    const [newWord, setNewWord] = useState<string>('');

    // State for hovered keyword
    const [hoveredKeyword, setHoveredKeyword] = useState<string | null>(null);

    // New state to track the keyword currently being dragged.
    const [draggingKeyword, setDraggingKeyword] = useState<DraggingKeyword | null>(null);

    const handleEdit = (word: string) => {
        setEditingWord(word);
        setNewWord(word);
    };

    const saveEdit = () => {
        setKeywords((prev) => prev.map((w) => (w === editingWord ? newWord : w)));
        setEditingWord(null);
        setNewWord('');
    };

    const handleDelete = (word: string) => {
        setKeywords((prev) => prev.filter((w) => w !== word));

        toast.info(<UndoNotification />, {
            autoClose: 5000,
            closeButton: false,
            data: {
                onUndo: () => {
                    setKeywords((prev) => [...prev, word]);
                }
            },
            onClose: (closedByUser) => {
                if (closedByUser) return;
            }
        });
    };

    // Update a keyword’s position in state.
    const updateKeywordPosition = (text: string, newX: number, newY: number) => {
        setPlacedKeywords((prev) =>
            prev.map((k) => (k.text === text ? { ...k, x: newX, y: newY } : k))
        );
    };

    // --- DRAG HANDLERS (Additional logic)

    // When a drag starts, record the keyword's starting position and the mouse's SVG coordinates.
    const handleDragStart = (e: React.MouseEvent, keyword: IKeywordBox & { rotation: number }) => {
        // Only allow drag for non–main keywords.
        if (keyword.text === mainTopic) return;
        e.preventDefault();
        e.stopPropagation();
        if (svgRef.current) {
            const pt = svgRef.current.createSVGPoint();
            pt.x = e.clientX;
            pt.y = e.clientY;
            const svgCTM = svgRef.current.getScreenCTM();
            if (!svgCTM) return;
            const inverseCTM = svgCTM.inverse();
            const svgPoint = pt.matrixTransform(inverseCTM);
            setDraggingKeyword({
                text: keyword.text,
                startX: keyword.x,
                startY: keyword.y,
                mouseStartX: svgPoint.x,
                mouseStartY: svgPoint.y,
                width: keyword.width,
                height: keyword.height
            });
        }
    };

    // When a drag is in progress, update the keyword's position.
    useEffect(() => {
        if (!draggingKeyword || !svgRef.current) return;

        const handleMouseMove = (e: MouseEvent) => {
            const pt = svgRef.current!.createSVGPoint();
            pt.x = e.clientX;
            pt.y = e.clientY;
            const svgCTM = svgRef.current!.getScreenCTM();
            if (!svgCTM) return;
            const inverseCTM = svgCTM.inverse();
            const svgPoint = pt.matrixTransform(inverseCTM);
            const deltaX = svgPoint.x - draggingKeyword.mouseStartX;
            const deltaY = svgPoint.y - draggingKeyword.mouseStartY;
            const newX = draggingKeyword.startX + deltaX;
            const newY = draggingKeyword.startY + deltaY;
            updateKeywordPosition(draggingKeyword.text, newX, newY);
        };

        const handleMouseUp = (e: MouseEvent) => {
            if (!svgRef.current || !draggingKeyword) return;
            const pt = svgRef.current.createSVGPoint();
            pt.x = e.clientX;
            pt.y = e.clientY;
            const svgCTM = svgRef.current.getScreenCTM();
            if (!svgCTM) return;
            const inverseCTM = svgCTM.inverse();
            const svgPoint = pt.matrixTransform(inverseCTM);
            const deltaX = svgPoint.x - draggingKeyword.mouseStartX;
            const deltaY = svgPoint.y - draggingKeyword.mouseStartY;
            const newX = draggingKeyword.startX + deltaX;
            const newY = draggingKeyword.startY + deltaY;
            // Calculate the keyword's center.
            const centerX = newX + draggingKeyword.width / 2;
            const centerY = newY + draggingKeyword.height / 2;
            // If the new center is outside the circle, revert to the original position.
            if (Math.sqrt(centerX * centerX + centerY * centerY) > radius) {
                updateKeywordPosition(
                    draggingKeyword.text,
                    draggingKeyword.startX,
                    draggingKeyword.startY
                );
            }
            setDraggingKeyword(null);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [draggingKeyword, radius]);

    // --- END OF DRAG HANDLERS

    useEffect(() => {
        // Instead of using the current container size, use the device's full screen size.
        const deviceWidth = window.screen.width;
        const deviceHeight = window.screen.height;
        const deviceDiameter = Math.min(deviceWidth, deviceHeight);
        const baseRadius = deviceDiameter / 2;
        setRadius(baseRadius);

        // 1. Place the main topic at the center.
        const mainW = measureTextWidth(mainTopic, MAIN_TOPIC_FONT_SIZE) + 30;
        const mainH = MAIN_TOPIC_FONT_SIZE + 10;
        const mainBox: IKeywordBox & { rotation: number } = {
            text: mainTopic,
            x: -mainW / 2,
            y: -mainH / 2,
            width: mainW,
            height: mainH,
            rotation: 0
        };

        // 2. Define a safe radius around the main topic.
        const mainRadius = Math.hypot(mainW, mainH) / 2 + PADDING_BETWEEN_WORDS;

        // 3. Get the other keywords (excluding the main topic)
        const otherKeywords = keywords.filter((k) => k !== mainTopic);
        let measured = otherKeywords.map((word) => ({
            word,
            width: measureTextWidth(word, OTHER_KEYWORD_FONT_SIZE) + 30,
            height: OTHER_KEYWORD_FONT_SIZE + 10
        }));

        // 4. Sort measured words descending by width and interleave them.
        measured.sort((a, b) => b.width - a.width);
        const orderedWords = interleaveArray(measured);
        const totalWords = orderedWords.length;

        const placedPhrases: (IKeywordBox & { rotation: number })[] = [];
        // Place the main topic first.
        placedPhrases.push(mainBox);

        // 5. For each other keyword, try to find a collision-free spot.
        orderedWords.forEach((item, sortedIndex) => {
            const halfDiagonal = Math.sqrt((item.width / 2) ** 2 + (item.height / 2) ** 2);
            const allowedCandidateRadius = baseRadius - EDGE_PADDING - halfDiagonal;
            const lowerBoundRadius = mainRadius + halfDiagonal + PADDING_BETWEEN_WORDS;
            let candidateRadius = allowedCandidateRadius;
            const baseAngle = (2 * Math.PI * sortedIndex) / totalWords - Math.PI / 2;
            let candidateAngle = baseAngle;

            let candidateBox: IKeywordBox = {
                text: item.word,
                x: 0,
                y: 0,
                width: item.width,
                height: item.height
            };

            let found = false;
            // Try several radii and angle offsets until a spot is found.
            for (
                let rCandidate = candidateRadius;
                rCandidate >= lowerBoundRadius;
                rCandidate -= RADIUS_STEP
            ) {
                for (const offset of ANGLE_OFFSETS) {
                    candidateAngle = baseAngle + offset;
                    const centerX = Math.cos(candidateAngle) * rCandidate;
                    const centerY = Math.sin(candidateAngle) * rCandidate;
                    candidateBox = {
                        text: item.word,
                        x: centerX - item.width / 2,
                        y: centerY - item.height / 2,
                        width: item.width,
                        height: item.height
                    };

                    // Ensure the word doesn't come too near the edge.
                    if (rCandidate + halfDiagonal > baseRadius - EDGE_PADDING) {
                        continue;
                    }

                    // Check collisions with already placed keywords.
                    let collision = false;
                    for (const placedBox of placedPhrases) {
                        if (areKeywordsColliding(candidateBox, placedBox)) {
                            collision = true;
                            break;
                        }
                    }
                    if (!collision) {
                        found = true;
                        candidateRadius = rCandidate;
                        break;
                    }
                }
                if (found) break;
            }

            // If no collision-free candidate was found, use the last candidateBox.
            const rotation = 0; // (Modify this if you want to rotate based on candidateAngle)
            placedPhrases.push({ ...candidateBox, rotation });
        });

        setPlacedKeywords(placedPhrases);
    }, [keywords, mainTopic]);

    // Reorder keywords so that the hovered one is rendered last (on top).
    const sortedKeywords = [...placedKeywords].sort((a, b) => {
        if (a.text === hoveredKeyword) return 1;
        if (b.text === hoveredKeyword) return -1;
        return 0;
    });

    return (
        <div
            style={{
                width: '100%',
                maxWidth: '100vw',
                height: 'calc(100vh - 7rem)',
                maxHeight: 'calc(100vh - 7rem)',
                margin: '0 auto'
            }}>
            {/* Editing Modal */}
            {editingWord && (
                <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50 z-50">
                    <div className="bg-white p-4 rounded shadow">
                        <h2 className="text-lg font-bold mb-2">Edit Word</h2>
                        <input
                            value={newWord}
                            onChange={(e) => setNewWord(e.target.value)}
                            className="border p-2 rounded w-full mb-2"
                        />
                        <div className="flex justify-end">
                            <button
                                onClick={() => setEditingWord(null)}
                                className="px-4 py-2 bg-gray-300 rounded mr-2">
                                Cancel
                            </button>
                            <button
                                onClick={saveEdit}
                                className="px-4 py-2 bg-blue-500 text-white rounded">
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <svg
                ref={svgRef}
                width="100%"
                height="100%"
                viewBox={`-${radius} -${radius} ${2 * radius} ${2 * radius}`}
                style={{ display: 'block', borderRadius: '50%' }}>
                {/* Background Circle */}
                <circle cx="0" cy="0" r={radius} className="fill-gray-100" stroke="#ccc" />

                {/* Lines connecting the center to each keyword (skip main topic) */}
                {sortedKeywords.map((kw) => {
                    if (kw.text === mainTopic) return null;
                    const centerX = kw.x + kw.width / 2;
                    const centerY = kw.y + kw.height / 2;
                    return (
                        <line
                            key={`line-${kw.text}`}
                            x1={0}
                            y1={0}
                            x2={centerX}
                            y2={centerY}
                            stroke="gray"
                            strokeWidth={1}
                        />
                    );
                })}

                {/* Render each keyword as a clickable element */}
                {sortedKeywords.map((kw, idx) => {
                    const isMain = kw.text === mainTopic;
                    const isSelected = selectedKeywords && selectedKeywords.includes(kw.text);
                    const bgClass = isSelected
                        ? 'bg-blue-200 text-blue-700'
                        : isMain
                          ? 'bg-white shadow-lg'
                          : 'bg-gray-300 text-gray-800';

                    return (
                        <foreignObject
                            key={kw.text}
                            x={kw.x}
                            y={kw.y}
                            width={kw.width}
                            height={kw.height}
                            style={{ overflow: 'visible' }}>
                            <div
                                // Add onMouseDown only for non–main keywords to initiate drag.
                                onMouseDown={
                                    !isMain
                                        ? (e) => {
                                              handleDragStart(e, kw);
                                          }
                                        : undefined
                                }
                                onMouseEnter={() => setHoveredKeyword(kw.text)}
                                onMouseLeave={() => setHoveredKeyword(null)}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleKeywordSelection && toggleKeywordSelection(kw.text);
                                }}
                                className={`keyword${idx} cursor-pointer group relative flex items-center justify-center w-full h-full rounded-lg font-bold transition duration-200 transform hover:scale-125 ${bgClass}`}
                                style={{
                                    fontSize: isMain
                                        ? MAIN_TOPIC_FONT_SIZE
                                        : OTHER_KEYWORD_FONT_SIZE,
                                    userSelect: 'none'
                                }}>
                                <div
                                    style={{
                                        transform: !isMain
                                            ? `rotate(${kw.rotation}deg)`
                                            : undefined,
                                        transformOrigin: 'center center'
                                    }}>
                                    {kw.text}
                                </div>
                                {/* Only non–main keywords show edit/delete buttons */}
                                {!isMain && (
                                    <div className="absolute -top-2 -right-2 flex space-x-1 opacity-0 group-hover:opacity-100">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleEdit(kw.text);
                                            }}
                                            className="text-blue-600 hover:text-blue-800">
                                            <FiEdit />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDelete(kw.text);
                                            }}
                                            className="text-red-600 hover:text-red-800">
                                            <FiTrash2 />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </foreignObject>
                    );
                })}
            </svg>
        </div>
    );
};

export default KeywordCloud;

import { useState, useEffect, useRef, FC } from 'react';
import { IKeywordBox } from '../../../types/Coding/shared';
import { KeywordCloudProps } from '../../../types/Coding/props';
import { FiEdit, FiTrash2 } from 'react-icons/fi';
import { useUndo } from '../../../hooks/Shared/use-undo';
import { Keyword } from '../../../types/Shared';
import { v4 as uuidv4 } from 'uuid';

const MAIN_TOPIC_FONT_SIZE = 20;
const OTHER_KEYWORD_FONT_SIZE = 14;
const PADDING_BETWEEN_WORDS = 10;
const EDGE_PADDING = 10;
const RADIUS_STEP = 5;
const ANGLE_OFFSETS = [0, -5, 5, -10, 10, -15, 15].map((deg) => (deg * Math.PI) / 180);

function measureTextWidth(text: string, fontSize: number): number {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.font = `${fontSize}px Arial`;
        return ctx.measureText(text).width;
    }
    return 50;
}

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
    text: Keyword;
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
    setKeywords,
    setSelectedKeywords
}) => {
    console.log('Rendering KeywordCloud', mainTopic, keywords, selectedKeywords);
    const { performWithUndo } = useUndo();
    const svgRef = useRef<SVGSVGElement | null>(null);
    const [placedKeywords, setPlacedKeywords] = useState<(IKeywordBox & { rotation: number })[]>(
        []
    );
    const [radius, setRadius] = useState<number>(0);
    const [editingWordId, setEditingWordId] = useState<string | null>(null);
    const [newWord, setNewWord] = useState<string>('');
    const [hoveredKeyword, setHoveredKeyword] = useState<string | null>(null);
    const [draggingKeyword, setDraggingKeyword] = useState<DraggingKeyword | null>(null);

    const handleEdit = (wordId: string) => {
        setEditingWordId(wordId);
        setNewWord(keywords.find((k) => k.id === wordId)?.word || '');
    };

    const saveEdit = () => {
        performWithUndo([keywords, selectedKeywords], [setKeywords, setSelectedKeywords], () => {
            setKeywords((prev) =>
                prev.map((k) => (k.id === editingWordId ? { ...k, word: newWord } : k))
            );
            setSelectedKeywords((prev) =>
                prev.find((sk) => sk === editingWordId) ? prev : [...prev, editingWordId]
            );
        });
        setEditingWordId(null);
        setNewWord('');
    };

    const handleDelete = (word: Keyword) => {
        performWithUndo([keywords], [setKeywords], () => {
            setKeywords((prev) => prev.filter((k) => k.id !== word.id));
        });
    };

    const updateKeywordPosition = (textId: string, newX: number, newY: number) => {
        setPlacedKeywords((prev) =>
            prev.map((k) => (k.text.id === textId ? { ...k, x: newX, y: newY } : k))
        );
    };

    const handleDragStart = (e: React.MouseEvent, keyword: IKeywordBox & { rotation: number }) => {
        if (keyword.text.word === mainTopic) return; // Main topic is not draggable
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
            updateKeywordPosition(draggingKeyword.text.id, newX, newY);
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
            const centerX = newX + draggingKeyword.width / 2;
            const centerY = newY + draggingKeyword.height / 2;
            if (Math.sqrt(centerX * centerX + centerY * centerY) > radius) {
                updateKeywordPosition(
                    draggingKeyword.text.id,
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

    useEffect(() => {
        const deviceWidth = window.screen.width;
        const deviceHeight = window.screen.height;
        const deviceDiameter = Math.min(deviceWidth, deviceHeight);
        const baseRadius = deviceDiameter / 2;
        setRadius(baseRadius);

        const normalizedKeywords = keywords.map((k) => ({
            id: k.id || uuidv4(),
            word: typeof k.word === 'string' ? k.word : String(k.word)
        }));

        const mainKeyword = mainTopic;

        const mainW = measureTextWidth(mainKeyword, MAIN_TOPIC_FONT_SIZE) + 30;
        const mainH = MAIN_TOPIC_FONT_SIZE + 10;
        const mainBox: IKeywordBox & { rotation: number } = {
            text: {
                id: uuidv4(),
                word: mainKeyword
            },
            x: -mainW / 2,
            y: -mainH / 2,
            width: mainW,
            height: mainH,
            rotation: 0
        };

        const mainRadius = Math.hypot(mainW, mainH) / 2 + PADDING_BETWEEN_WORDS;
        const otherKeywords = normalizedKeywords.filter((k) => k.word !== mainTopic);
        let measured = otherKeywords.map((k) => ({
            text: k,
            width: measureTextWidth(k.word, OTHER_KEYWORD_FONT_SIZE) + 30,
            height: OTHER_KEYWORD_FONT_SIZE + 10
        }));

        measured.sort((a, b) => b.width - a.width);
        const orderedWords = interleaveArray(measured);
        const totalWords = orderedWords.length;

        const placedPhrases: (IKeywordBox & { rotation: number })[] = [mainBox];

        orderedWords.forEach((item, sortedIndex) => {
            const halfDiagonal = Math.sqrt((item.width / 2) ** 2 + (item.height / 2) ** 2);
            const allowedCandidateRadius = baseRadius - EDGE_PADDING - halfDiagonal;
            const lowerBoundRadius = mainRadius + halfDiagonal + PADDING_BETWEEN_WORDS;
            let candidateRadius = allowedCandidateRadius;
            const baseAngle = (2 * Math.PI * sortedIndex) / totalWords - Math.PI / 2;
            let candidateAngle = baseAngle;

            let candidateBox: IKeywordBox = {
                text: item.text,
                x: 0,
                y: 0,
                width: item.width,
                height: item.height
            };

            let found = false;
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
                        text: item.text,
                        x: centerX - item.width / 2,
                        y: centerY - item.height / 2,
                        width: item.width,
                        height: item.height
                    };

                    if (rCandidate + halfDiagonal > baseRadius - EDGE_PADDING) {
                        continue;
                    }

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

            const rotation = 0;
            placedPhrases.push({ ...candidateBox, rotation });
        });

        setPlacedKeywords(placedPhrases);
    }, [keywords, mainTopic]); // *** Updated dependency ***

    // Sort keywords to render hovered one last (unchanged)
    const sortedKeywords = [...placedKeywords].sort((a, b) => {
        if (a.text.id === hoveredKeyword) return 1;
        if (b.text.id === hoveredKeyword) return -1;
        return 0;
    });

    // Render (updated to use mainTopicString)
    return (
        <div
            style={{
                width: '100%',
                maxWidth: '100vw',
                height: 'calc(100vh - 11rem)',
                maxHeight: 'calc(100vh - 11rem)',
                margin: '0 auto'
            }}>
            {/* Editing Modal (unchanged) */}
            {editingWordId && (
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
                                onClick={() => setEditingWordId(null)}
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
                <circle cx="0" cy="0" r={radius} className="fill-gray-100" stroke="#ccc" />

                {/* Lines connecting center to keywords (unchanged) */}
                {sortedKeywords.map((kw) => {
                    if (kw.text.word === mainTopic) return null; // Updated here
                    const centerX = kw.x + kw.width / 2;
                    const centerY = kw.y + kw.height / 2;
                    return (
                        <line
                            key={`line-${kw.text.id}`}
                            x1={0}
                            y1={0}
                            x2={centerX}
                            y2={centerY}
                            stroke="gray"
                            strokeWidth={1}
                        />
                    );
                })}

                {/* Render keywords (updated to use mainTopicString) */}
                {sortedKeywords.map((kw, idx) => {
                    // console.log('Rendering keyword:', kw, mainTopic);
                    const isMain = kw.text.word === mainTopic; // Updated here
                    const isSelected = selectedKeywords.some((sk) => sk === kw.text.id || isMain);
                    const bgClass = isSelected
                        ? 'bg-blue-200 text-blue-700'
                        : isMain
                          ? 'bg-white shadow-lg'
                          : 'bg-gray-300 text-gray-800';

                    return (
                        <foreignObject
                            key={kw.text.id}
                            x={kw.x}
                            y={kw.y}
                            width={kw.width}
                            height={kw.height}
                            style={{ overflow: 'visible' }}>
                            <div
                                onMouseDown={!isMain ? (e) => handleDragStart(e, kw) : undefined}
                                onMouseEnter={() => setHoveredKeyword(kw.text.id)}
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
                                    {kw.text.word}
                                </div>
                                {!isMain && (
                                    <div className="absolute -top-2 -right-2 flex space-x-1 opacity-0 group-hover:opacity-100">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleEdit(kw.text.id);
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

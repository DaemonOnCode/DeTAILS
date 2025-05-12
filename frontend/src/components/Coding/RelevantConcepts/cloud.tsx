import { useState, useEffect, useRef, FC } from 'react';
import { IConceptBox } from '../../../types/Coding/shared';
import { ConceptCloudProps } from '../../../types/Coding/props';
import { FiEdit, FiTrash2 } from 'react-icons/fi';
import { useUndo } from '../../../hooks/Shared/use-undo';
import { Concept } from '../../../types/Shared';
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

function areConceptsColliding(
    a: IConceptBox,
    b: IConceptBox,
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

interface DraggingConcept {
    text: Concept;
    startX: number;
    startY: number;
    mouseStartX: number;
    mouseStartY: number;
    width: number;
    height: number;
}

const ConceptCloud: FC<ConceptCloudProps> = ({
    mainTopic,
    concepts,
    selectedConcepts,
    toggleConceptSelection,
    setConcepts,
    setSelectedConcepts
}) => {
    // console.log('Rendering ConceptCloud', mainTopic, concepts, selectedConcepts);
    const { performWithUndo } = useUndo();
    const svgRef = useRef<SVGSVGElement | null>(null);
    const [placedConcepts, setPlacedConcepts] = useState<(IConceptBox & { rotation: number })[]>(
        []
    );
    const [radius, setRadius] = useState<number>(0);
    const [editingWordId, setEditingWordId] = useState<string | null>(null);
    const [newWord, setNewWord] = useState<string>('');
    const [hoveredConcept, setHoveredConcept] = useState<string | null>(null);
    const [draggingConcept, setDraggingConcept] = useState<DraggingConcept | null>(null);

    const handleEdit = (wordId: string) => {
        setEditingWordId(wordId);
        setNewWord(concepts.find((k) => k.id === wordId)?.word || '');
    };

    const saveEdit = () => {
        performWithUndo(
            [concepts, selectedConcepts],
            [setConcepts, setSelectedConcepts],
            () => {
                setConcepts((prev) =>
                    prev.map((k) => (k.id === editingWordId ? { ...k, word: newWord } : k))
                );
                setSelectedConcepts((prev) =>
                    prev.find((sk) => sk === editingWordId) ? prev : [...prev, editingWordId]
                );
            },
            false
        );
        setEditingWordId(null);
        setNewWord('');
    };

    const handleDelete = (word: Concept) => {
        performWithUndo([concepts], [setConcepts], () => {
            setConcepts((prev) => prev.filter((k) => k.id !== word.id));
        });
    };

    const updateConceptPosition = (textId: string, newX: number, newY: number) => {
        setPlacedConcepts((prev) =>
            prev.map((k) => (k.text.id === textId ? { ...k, x: newX, y: newY } : k))
        );
    };

    const handleDragStart = (e: React.MouseEvent, concept: IConceptBox & { rotation: number }) => {
        if (concept.text.word === mainTopic) return; // Prevent dragging main topic
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
            setDraggingConcept({
                text: concept.text,
                startX: concept.x,
                startY: concept.y,
                mouseStartX: svgPoint.x,
                mouseStartY: svgPoint.y,
                width: concept.width,
                height: concept.height
            });
        }
    };

    useEffect(() => {
        if (!draggingConcept || !svgRef.current) return;

        const handleMouseMove = (e: MouseEvent) => {
            const pt = svgRef.current!.createSVGPoint();
            pt.x = e.clientX;
            pt.y = e.clientY;
            const svgCTM = svgRef.current!.getScreenCTM();
            if (!svgCTM) return;
            const inverseCTM = svgCTM.inverse();
            const svgPoint = pt.matrixTransform(inverseCTM);
            const deltaX = svgPoint.x - draggingConcept.mouseStartX;
            const deltaY = svgPoint.y - draggingConcept.mouseStartY;
            const newX = draggingConcept.startX + deltaX;
            const newY = draggingConcept.startY + deltaY;
            updateConceptPosition(draggingConcept.text.id, newX, newY);
        };

        const handleMouseUp = (e: MouseEvent) => {
            if (!svgRef.current || !draggingConcept) return;
            const pt = svgRef.current.createSVGPoint();
            pt.x = e.clientX;
            pt.y = e.clientY;
            const svgCTM = svgRef.current.getScreenCTM();
            if (!svgCTM) return;
            const inverseCTM = svgCTM.inverse();
            const svgPoint = pt.matrixTransform(inverseCTM);
            const deltaX = svgPoint.x - draggingConcept.mouseStartX;
            const deltaY = svgPoint.y - draggingConcept.mouseStartY;
            const newX = draggingConcept.startX + deltaX;
            const newY = draggingConcept.startY + deltaY;
            const centerX = newX + draggingConcept.width / 2;
            const centerY = newY + draggingConcept.height / 2;
            if (Math.sqrt(centerX * centerX + centerY * centerY) > radius) {
                updateConceptPosition(
                    draggingConcept.text.id,
                    draggingConcept.startX,
                    draggingConcept.startY
                );
            }
            setDraggingConcept(null);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [draggingConcept, radius]);

    useEffect(() => {
        const deviceWidth = window.screen.width;
        const deviceHeight = window.screen.height;
        const deviceDiameter = Math.min(deviceWidth, deviceHeight);
        const baseRadius = deviceDiameter / 2;
        setRadius(baseRadius);

        const normalizedConcepts = concepts.map((k) => ({
            id: k.id || uuidv4(),
            word: typeof k.word === 'string' ? k.word : String(k.word)
        }));

        const mainConcept = mainTopic;

        const mainW = measureTextWidth(mainConcept, MAIN_TOPIC_FONT_SIZE) + 30;
        const mainH = MAIN_TOPIC_FONT_SIZE + 10;
        const mainBox: IConceptBox & { rotation: number } = {
            text: {
                id: uuidv4(),
                word: mainConcept
            },
            x: -mainW / 2,
            y: -mainH / 2,
            width: mainW,
            height: mainH,
            rotation: 0
        };

        const mainRadius = Math.hypot(mainW, mainH) / 2 + PADDING_BETWEEN_WORDS;
        const otherConcepts = normalizedConcepts.filter((k) => k.word !== mainTopic);
        let measured = otherConcepts.map((k) => ({
            text: k,
            width: measureTextWidth(k.word, OTHER_KEYWORD_FONT_SIZE) + 30,
            height: OTHER_KEYWORD_FONT_SIZE + 10
        }));

        measured.sort((a, b) => b.width - a.width);
        const orderedWords = interleaveArray(measured);
        const totalWords = orderedWords.length;

        const placedPhrases: (IConceptBox & { rotation: number })[] = [mainBox];

        orderedWords.forEach((item, sortedIndex) => {
            const halfDiagonal = Math.sqrt((item.width / 2) ** 2 + (item.height / 2) ** 2);
            const allowedCandidateRadius = baseRadius - EDGE_PADDING - halfDiagonal;
            const lowerBoundRadius = mainRadius + halfDiagonal + PADDING_BETWEEN_WORDS;
            let candidateRadius = allowedCandidateRadius;
            const baseAngle = (2 * Math.PI * sortedIndex) / totalWords - Math.PI / 2;
            let candidateAngle = baseAngle;

            let candidateBox: IConceptBox = {
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
                        if (areConceptsColliding(candidateBox, placedBox)) {
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

        setPlacedConcepts(placedPhrases);
    }, [concepts, mainTopic]);

    const sortedConcepts = [...placedConcepts].sort((a, b) => {
        if (a.text.id === hoveredConcept) return 1;
        if (b.text.id === hoveredConcept) return -1;
        return 0;
    });

    return (
        <div
            style={{
                width: '100%',
                maxWidth: '100vw',
                height: 'calc(100vh - 11rem)',
                maxHeight: 'calc(100vh - 11rem)',
                margin: '0 auto'
            }}>
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

                {sortedConcepts.map((kw) => {
                    if (kw.text.word === mainTopic) return null;
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

                {sortedConcepts.map((kw, idx) => {
                    const isMain = kw.text.word === mainTopic;
                    const isSelected = selectedConcepts.some((sk) => sk === kw.text.id || isMain);
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
                                onMouseEnter={() => setHoveredConcept(kw.text.id)}
                                onMouseLeave={() => setHoveredConcept(null)}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleConceptSelection && toggleConceptSelection(kw.text);
                                }}
                                className={`concept${idx} cursor-pointer group relative flex items-center justify-center w-full h-full rounded-lg font-bold transition duration-200 transform hover:scale-125 ${bgClass}`}
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

export default ConceptCloud;

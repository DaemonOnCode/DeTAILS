import { useState, useEffect, useRef, FC } from 'react';
import { IKeywordBox } from '../../../types/Coding/shared';
import { KeywordCloudProps } from '../../../types/Coding/props';
import { FiEdit, FiTrash2 } from 'react-icons/fi';

const MAIN_TOPIC_FONT_SIZE = 20;
const OTHER_KEYWORD_FONT_SIZE = 14;
const PADDING_BETWEEN_WORDS = 10;

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
) {
    return !(
        a.x + a.width + padding < b.x ||
        a.x > b.x + b.width + padding ||
        a.y + a.height + padding < b.y ||
        a.y > b.y + b.height + padding
    );
}

function isInsideCircle(x: number, y: number, r: number) {
    return x * x + y * y <= r * r;
}

const KeywordCloud: FC<KeywordCloudProps> = ({
    mainTopic,
    keywords,
    selectedKeywords,
    toggleKeywordSelection,
    setKeywords
}) => {
    const svgRef = useRef<SVGSVGElement | null>(null);

    const [placedKeywords, setPlacedKeywords] = useState<IKeywordBox[]>([]);
    const [radius, setRadius] = useState<number>(0);

    const [editingWord, setEditingWord] = useState<string | null>(null);
    const [newWord, setNewWord] = useState<string>('');

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
    };

    useEffect(() => {
        if (!svgRef.current) return;

        // Grab actual rendered size of the <svg> (which we will make square).
        const { width, height } = svgRef.current.getBoundingClientRect();
        // Circle radius is half of the smaller dimension
        const diameter = Math.min(width, height);
        const r = diameter / 2;

        // Prepare main topic
        const mainW = measureTextWidth(mainTopic, MAIN_TOPIC_FONT_SIZE) + 30;
        const mainH = MAIN_TOPIC_FONT_SIZE + 10;
        const mainBox: IKeywordBox = {
            text: mainTopic,
            // We place the center of this box at (0,0).
            // If you want the top-left corner at (0,0), you'd adjust differently.
            // We'll store x,y as the "top-left" though, so subtract half.
            x: -mainW / 2,
            y: -mainH / 2,
            width: mainW,
            height: mainH
        };

        // Filter out the mainTopic from the array
        const otherKeywords = keywords.filter((k) => k !== mainTopic);
        // Sort by descending width so bigger words (longer text) get placed first
        otherKeywords.sort((a, b) => {
            const wA = measureTextWidth(a, OTHER_KEYWORD_FONT_SIZE);
            const wB = measureTextWidth(b, OTHER_KEYWORD_FONT_SIZE);
            return wB - wA;
        });

        const placed: IKeywordBox[] = [mainBox];

        // Spiral placement function
        function placeKeywordSpiral(word: string) {
            const w = measureTextWidth(word, OTHER_KEYWORD_FONT_SIZE) + 30;
            const h = OTHER_KEYWORD_FONT_SIZE + 10;

            const box: IKeywordBox = {
                text: word,
                x: 0,
                y: 0,
                width: w,
                height: h
            };

            // Start near the center (just outside main topic radius)
            let rad = mainW + 20;
            let angle = 0;
            const angleIncrement = 0.1;
            const radiusIncrement = 2;

            while (rad < r) {
                // Proposed position: top-left corner
                const x = rad * Math.cos(angle) - w / 2;
                const y = rad * Math.sin(angle) - h / 2;
                box.x = x;
                box.y = y;

                // Quick boundary check:
                // We'll approximate by ensuring the center of the text is in the circle
                const centerX = x + w / 2;
                const centerY = y + h / 2;
                const halfDiagonal = Math.sqrt((w / 2) ** 2 + (h / 2) ** 2);
                // If the center is within (radius - halfDiagonal) => the corners won't exceed
                if (isInsideCircle(centerX, centerY, r - halfDiagonal)) {
                    // Check collision with placed items
                    let collision = false;
                    for (const p of placed) {
                        if (areKeywordsColliding(box, p)) {
                            collision = true;
                            break;
                        }
                    }
                    if (!collision) {
                        // Found a spot, add to list
                        placed.push({ ...box });
                        return;
                    }
                }

                angle += angleIncrement;
                if (angle > 2 * Math.PI) {
                    angle = 0;
                    rad += radiusIncrement;
                }
            }

            console.warn('Could not place word:', word);
        }

        otherKeywords.forEach(placeKeywordSpiral);

        setPlacedKeywords(placed);
        setRadius(r);
    }, [keywords, mainTopic]);

    return (
        <div
            style={{
                width: '100%',
                maxWidth: '100vw',
                height: 'calc(100vh - 7rem)',
                maxHeight: 'calc(100vh - 7rem)',
                margin: '0 auto'
            }}>
            {editingWord && (
                <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50 z-50">
                    <div className="bg-white p-4 rounded shadow">
                        <h2>Edit Word</h2>
                        <input
                            value={newWord}
                            onChange={(e) => setNewWord(e.target.value)}
                            className="border p-2 rounded w-full"
                        />
                        <div className="flex justify-end mt-2">
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
                // Force the SVG to be square
                width="100%"
                height="100%"
                viewBox={`-${radius} -${radius} ${2 * radius} ${2 * radius}`}
                style={{
                    display: 'block', // remove default inline spacing for svg
                    borderRadius: '50%' // visually clip to a circle
                }}>
                {/* OPTIONAL: Draw a background circle if you want it explicitly */}
                <circle cx="0" cy="0" r={radius} className="fill-gray-100" stroke="#ccc" />

                {/* Lines from the center (0,0) to each keyword (center of its box) */}
                {placedKeywords.map((kw) => {
                    if (kw.text === mainTopic) return null; // skip mainTopic line
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

                {/* Render each keyword as <foreignObject> or <text> or absolutely-positioned div */}
                {placedKeywords.map((kw) => {
                    const centerX = kw.x + kw.width / 2;
                    const centerY = kw.y + kw.height / 2;
                    const isMainTopic = kw.text === mainTopic;

                    return (
                        <foreignObject
                            key={kw.text}
                            x={kw.x}
                            y={kw.y}
                            width={kw.width}
                            height={kw.height}
                            style={{ overflow: 'visible' }}>
                            <div
                                onClick={() => toggleKeywordSelection(kw.text)}
                                className={`cursor-pointer group
                  flex items-center justify-center
                  w-full h-full
                  rounded-lg font-bold
                  ${
                      selectedKeywords.includes(kw.text)
                          ? 'bg-blue-200 text-blue-700'
                          : 'bg-gray-300 text-gray-800'
                  }
                `}
                                style={{
                                    fontSize: isMainTopic
                                        ? MAIN_TOPIC_FONT_SIZE
                                        : OTHER_KEYWORD_FONT_SIZE,
                                    position: 'relative'
                                }}>
                                {kw.text}
                                {!isMainTopic && (
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

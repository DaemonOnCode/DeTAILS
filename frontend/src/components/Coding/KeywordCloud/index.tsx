import { useState, useEffect, FC } from 'react';
import { IKeywordBox } from '../../../types/Coding/shared';
import { KeywordCloudProps } from '../../../types/Coding/props';
import { FiEdit, FiTrash2 } from 'react-icons/fi'; // Import React Icons

const mainTopicFontSize = 20;
const otherKeywordFontSize = 14;

function areKeywordsColliding(keyword1: IKeywordBox, keyword2: IKeywordBox, padding: number = 10) {
    return !(
        keyword1.x + keyword1.width + padding < keyword2.x ||
        keyword1.x > keyword2.x + keyword2.width + padding ||
        keyword1.y + keyword1.height + padding < keyword2.y ||
        keyword1.y > keyword2.y + keyword2.height + padding
    );
}

function placeKeyword(keywords: IKeywordBox[], newKeyword: IKeywordBox, mainTopicBox: IKeywordBox) {
    if (areKeywordsColliding(mainTopicBox, newKeyword)) {
        return false;
    }

    for (let placedKeyword of keywords) {
        if (areKeywordsColliding(placedKeyword, newKeyword)) {
            return false; // Collision detected
        }
    }
    return true; // No collision
}

const measureTextWidth = (text: string, fontSize: number) => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (context) {
        context.font = `${fontSize}px Arial`;
        return context.measureText(text).width;
    }
    return 50;
};

const KeywordCloud: FC<KeywordCloudProps> = ({
    mainTopic,
    keywords,
    selectedKeywords,
    toggleKeywordSelection,
    setKeywords
}) => {
    const [keywordsPlaced, setKeywordsPlaced] = useState<IKeywordBox[]>([]);
    const [maxRadius, setMaxRadius] = useState(0);
    const [editingWord, setEditingWord] = useState<string | null>(null);
    const [newWord, setNewWord] = useState<string>('');
    const radiusIncrement = 50;

    const placeKeywordsAround = (): IKeywordBox[] => {
        const placedKeywords: IKeywordBox[] = [];
        const mainTopicWidth = measureTextWidth(mainTopic, mainTopicFontSize) + 30;
        const mainTopicHeight = mainTopicFontSize + 10;

        const mainTopicBox: IKeywordBox = {
            text: mainTopic,
            x: 0,
            y: 0,
            width: mainTopicWidth,
            height: mainTopicHeight
        };

        placedKeywords.push(mainTopicBox);

        keywords.forEach((keyword, index) => {
            if (keyword === mainTopic) return;
            const textWidth = measureTextWidth(keyword, otherKeywordFontSize);
            const keywordBox: IKeywordBox = {
                text: keyword,
                x: 0,
                y: 0,
                width: textWidth + 30,
                height: otherKeywordFontSize + 10
            };

            let angle = (index * (2 * Math.PI)) / keywords.length; // Spread keywords evenly
            let radius = mainTopicWidth + 50;
            let placed = false;

            while (!placed) {
                const x = radius * Math.cos(angle);
                const y = radius * Math.sin(angle);
                keywordBox.x = x;
                keywordBox.y = y;

                if (placeKeyword(placedKeywords, keywordBox, mainTopicBox)) {
                    if (keywordBox.text === mainTopic) continue;
                    placedKeywords.push(keywordBox);
                    placed = true;
                } else {
                    radius += radiusIncrement;
                    if (radius > 1000) {
                        console.warn(`Could not place keyword: ${keyword}`);
                        break;
                    }
                }
            }
        });
        return placedKeywords;
    };

    useEffect(() => {
        const placedKeywords = placeKeywordsAround();
        setKeywordsPlaced(placedKeywords);

        const maxDistance = placedKeywords.reduce((max, keyword) => {
            const distance =
                Math.sqrt(keyword.x ** 2 + keyword.y ** 2) +
                Math.max(keyword.width, keyword.height) / 2;
            return Math.max(max, distance);
        }, 0);
        setMaxRadius(maxDistance + 40);
    }, [keywords, selectedKeywords]);

    const handleDelete = (keyword: string) => {
        setKeywords(keywords.filter((t) => t !== keyword));
    };

    const handleEdit = (keyword: string) => {
        setEditingWord(keyword);
        setNewWord(keyword);
    };

    const saveEdit = () => {
        setKeywords(keywords.map((keyword) => (keyword === editingWord ? newWord : keyword)));
        setEditingWord(null);
        setNewWord('');
    };

    return (
        <div
            className="relative bg-gray-100 rounded-full shadow-lg"
            style={{
                width: `${maxRadius * 2}px`,
                height: `${maxRadius * 2}px`,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
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
                width={maxRadius * 2}
                height={maxRadius * 2}
                viewBox={`-${maxRadius} -${maxRadius} ${maxRadius * 2} ${maxRadius * 2}`}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0
                }}>
                {keywordsPlaced.map((keyword) => {
                    if (keyword.text === mainTopic) return null;

                    const keywordX = keyword.x;
                    const keywordY = keyword.y;

                    return (
                        <line
                            key={`line-${keyword.text}`}
                            x1={0}
                            y1={0}
                            x2={keywordX}
                            y2={keywordY}
                            stroke="gray"
                            strokeWidth="1"
                        />
                    );
                })}
            </svg>

            {keywordsPlaced.map((keyword) => (
                <div
                    key={keyword.text}
                    className="absolute cursor-pointer group"
                    style={{
                        top: `${keyword.y + maxRadius}px`,
                        left: `${keyword.x + maxRadius}px`,
                        transform: 'translate(-50%, -50%)'
                    }}
                    onClick={() => toggleKeywordSelection(keyword.text)}>
                    <div
                        className={`px-3 py-1 rounded-lg ${
                            selectedKeywords.includes(keyword.text)
                                ? 'bg-blue-200 text-blue-700'
                                : 'bg-gray-200 text-gray-800'
                        } font-bold relative`}
                        style={{
                            fontSize:
                                keyword.text === mainTopic
                                    ? mainTopicFontSize
                                    : otherKeywordFontSize
                        }}>
                        {keyword.text}

                        {/* Hover Actions */}
                        {keyword.text !== mainTopic && (
                            <div className="absolute -top-2 -right-2 flex space-x-1 opacity-0 group-hover:opacity-100">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleEdit(keyword.text);
                                    }}
                                    className="text-blue-600 hover:text-blue-800">
                                    <FiEdit />
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(keyword.text);
                                    }}
                                    className="text-red-600 hover:text-red-800">
                                    <FiTrash2 />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default KeywordCloud;

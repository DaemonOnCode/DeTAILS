// WordCloud.tsx
import React, { useState, useEffect } from 'react';
import { IWordBox } from '../../types/shared';

interface WordCloudProps {
    mainWord: string;
    words: string[];
    selectedWords: string[];
    toggleWordSelection: (word: string) => void;
}

const mainWordFontSize = 20;
const otherWordFontSize = 14;

function areWordsColliding(word1: IWordBox, word2: IWordBox, padding: number = 5) {
    return !(
        word1.x + word1.width + padding < word2.x ||
        word1.x > word2.x + word2.width + padding ||
        word1.y + word1.height + padding < word2.y ||
        word1.y > word2.y + word2.height + padding
    );
}

function placeWord(words: IWordBox[], newWord: IWordBox) {
    for (let placedWord of words) {
        if (areWordsColliding(placedWord, newWord)) {
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

const WordCloud: React.FC<WordCloudProps> = ({
    mainWord,
    words,
    selectedWords,
    toggleWordSelection
}) => {
    const [wordsPlaced, setWordsPlaced] = useState<IWordBox[]>([]);
    const [maxRadius, setMaxRadius] = useState(0);

    const radiusIncrement = 20;

    const placeWordsAround = (): IWordBox[] => {
        const placedWords: IWordBox[] = [];
        const mainWordWidth = measureTextWidth(mainWord, mainWordFontSize) + 30;
        const mainWordHeight = mainWordFontSize + 10;

        placedWords.push({
            text: mainWord,
            x: 0,
            y: 0,
            width: mainWordWidth,
            height: mainWordHeight
        });

        words.forEach((word, index) => {
            const textWidth = measureTextWidth(word, otherWordFontSize);
            const wordBox: IWordBox = {
                text: word,
                x: 0,
                y: 0,
                width: textWidth + 30,
                height: otherWordFontSize + 10
            };

            let angle = index * 0.8;
            let radius = 100;
            let placed = false;

            while (!placed) {
                const x = radius * Math.cos(angle);
                const y = radius * Math.sin(angle);
                wordBox.x = x;
                wordBox.y = y;

                if (placeWord(placedWords, wordBox)) {
                    placedWords.push(wordBox);
                    placed = true;
                } else {
                    radius += radiusIncrement;
                    if (radius > 1000) {
                        console.warn(`Could not place word: ${word}`);
                        break;
                    }
                }
            }
        });
        return placedWords;
    };

    useEffect(() => {
        const placedWords = placeWordsAround();
        setWordsPlaced(placedWords);

        // Calculate max radius to contain all words
        const maxDistance = placedWords.reduce((max, word) => {
            const distance =
                Math.sqrt(word.x ** 2 + word.y ** 2) + Math.max(word.width, word.height) / 2;
            return Math.max(max, distance);
        }, 0);
        setMaxRadius(maxDistance + 40); // Add padding
    }, [words, selectedWords]);

    return (
        <div
            className="relative bg-gray-100 rounded-full shadow-lg"
            style={{ width: maxRadius * 2, height: maxRadius * 2 }}>
            <svg
                width={maxRadius * 2}
                height={maxRadius * 2}
                style={{ position: 'absolute', top: 0, left: 0, zIndex: 0 }}>
                {wordsPlaced.map((word) => {
                    if (word.text === mainWord) return null;

                    const mainWordX = maxRadius;
                    const mainWordY = maxRadius;
                    const wordX = word.x + maxRadius;
                    const wordY = word.y + maxRadius;

                    return (
                        <line
                            key={`line-${word.text}`}
                            x1={mainWordX}
                            y1={mainWordY}
                            x2={wordX}
                            y2={wordY}
                            stroke="gray"
                            strokeWidth="1"
                        />
                    );
                })}
            </svg>

            {wordsPlaced.map((word) => (
                <div
                    key={word.text}
                    className="absolute cursor-pointer"
                    style={{
                        top: `${word.y + maxRadius}px`,
                        left: `${word.x + maxRadius}px`,
                        transform: 'translate(-50%, -50%)'
                    }}
                    onClick={() => toggleWordSelection(word.text)}>
                    <div
                        className={`px-3 py-1 rounded-lg ${
                            selectedWords.includes(word.text)
                                ? 'bg-blue-200 text-blue-700'
                                : 'bg-gray-200 text-gray-800'
                        } font-bold`}
                        style={{
                            fontSize: word.text === mainWord ? mainWordFontSize : otherWordFontSize
                        }}>
                        {word.text}
                    </div>
                    {selectedWords.includes(word.text) && (
                        <div className="absolute top-0 right-0 transform translate-x-1/2 -translate-y-1/2">
                            <div className="bg-green-500 rounded-full w-4 h-4 flex items-center justify-center">
                                <span className="text-white text-xs font-bold">✓</span>
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

export default WordCloud;

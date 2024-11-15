import React, { useState, useEffect } from "react";

interface WordBox {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

function areWordsColliding(word1: WordBox, word2: WordBox, padding: number = 5) {
  return !(
    word1.x + word1.width + padding < word2.x || // word1 is to the left of word2
    word1.x > word2.x + word2.width + padding || // word1 is to the right of word2
    word1.y + word1.height + padding < word2.y || // word1 is above word2
    word1.y > word2.y + word2.height + padding    // word1 is below word2
  );
}

function placeWord(words: WordBox[], newWord: WordBox) {
  for (let placedWord of words) {
    if (areWordsColliding(placedWord, newWord)) {
      return false; // Collision detected
    }
  }
  return true; // No collision
}

const measureTextWidth = (text: string, fontSize: number) => {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (context) {
    context.font = `${fontSize}px Arial`;
    return context.measureText(text).width;
  }
  return 50; // Default width if context is unavailable
};

const words = [
  "JavaScript", "SVG", "CSS", "HTML", "Node", "TypeScript", "GraphQL", "Redux",
  "Python", "Ruby", "Java", "C++", "Go", "Swift", "Kotlin", "Rust", "PHP", "SQL",
  "Django"
];

const mainWordFontSize = 20;
const otherWordFontSize = 14;

const WordCloud: React.FC = () => {
  const mainWord = "React";
  const [selectedWords, setSelectedWords] = useState<string[]>([mainWord]);
  const [wordsPlaced, setWordsPlaced] = useState<WordBox[]>([]);
  const [boundingBoxDimensions, setBoundingBoxDimensions] = useState({
    width: 500,
    height: 500,
    xOffset: 0,
    yOffset: 0,
    padding: 20,
  });

  const radiusIncrement = 20;

  const toggleWordSelection = (word: string) => {
    if (word === mainWord) return;
    setSelectedWords((prevSelected) =>
      prevSelected.includes(word)
        ? prevSelected.filter((w) => w !== word) // Deselect word
        : [...prevSelected, word]               // Select word
    );
  };

  const placeWordsAround = (): WordBox[] => {
    const placedWords: WordBox[] = [];

    const mainWordWidth = measureTextWidth(mainWord, mainWordFontSize) + 30;
    const mainWordHeight = mainWordFontSize + 10;

    // Place the main word at the center
    placedWords.push({
      text: mainWord,
      x: 0,
      y: 0,
      width: mainWordWidth,
      height: mainWordHeight,
    });

    // Place other words around the main word
    words.forEach((word, index) => {
      const textWidth = measureTextWidth(word, otherWordFontSize);
      const wordBox: WordBox = {
        text: word,
        x: 0,
        y: 0,
        width: textWidth + 30,
        height: otherWordFontSize + 10,
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

  const calculateBoundingBox = (words: WordBox[]) => {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    words.forEach(word => {
      const wordLeft = word.x - word.width / 2;
      const wordRight = word.x + word.width / 2;
      const wordTop = word.y - word.height / 2;
      const wordBottom = word.y + word.height / 2;

      if (wordLeft < minX) minX = wordLeft;
      if (wordRight > maxX) maxX = wordRight;
      if (wordTop < minY) minY = wordTop;
      if (wordBottom > maxY) maxY = wordBottom;
    });

    const padding = 20; // Add padding around the bounding box
    return {
      width: maxX - minX + 2 * padding,
      height: maxY - minY + 2 * padding,
      xOffset: -minX + padding,
      yOffset: -minY + padding,
      padding,
    };
  };

  useEffect(() => {
    const placedWords = placeWordsAround();
    setWordsPlaced(placedWords);

    const boundingBox = calculateBoundingBox(placedWords);
    setBoundingBoxDimensions(boundingBox);
  }, []);

  return (
    <div className="flex justify-center items-center mt-8">
      <div
        className="relative"
        style={{ width: boundingBoxDimensions.width, height: boundingBoxDimensions.height }}
      >
        {/* Draw the bounding box around all elements */}
        <svg
          width={boundingBoxDimensions.width}
          height={boundingBoxDimensions.height}
          className="absolute top-0 left-0 z-0"
        >
          <rect
            x={0}
            y={0}
            width={boundingBoxDimensions.width}
            height={boundingBoxDimensions.height}
            fill="none"
            stroke="gray"
            strokeWidth="1"
          />
          {/* Connect each word to the main word */}
          {wordsPlaced.map((word) => {
            if (word.text === mainWord) return null;
            return (
              <line
                key={`line-${word.text}`}
                x1={boundingBoxDimensions.width / 2}
                y1={boundingBoxDimensions.height / 2}
                x2={word.x + boundingBoxDimensions.xOffset}
                y2={word.y + boundingBoxDimensions.yOffset}
                stroke="gray"
                strokeWidth="0.5"
              />
            );
          })}
        </svg>

        {/* Render words */}
        {wordsPlaced.map((word) => (
          <div
            key={word.text}
            className="absolute"
            style={{
              top: `${word.y + boundingBoxDimensions.yOffset}px`,
              left: `${word.x + boundingBoxDimensions.xOffset}px`,
              transform: "translate(-50%, -50%)",
            }}
            onClick={() => toggleWordSelection(word.text)}
          >
            <div
              className={`px-3 py-1 rounded-lg ${
                selectedWords.includes(word.text) ? "bg-blue-200 text-blue-700" : "bg-gray-200 text-gray-800"
              } font-bold`}
              style={{
                fontSize: word.text === mainWord ? mainWordFontSize : otherWordFontSize,
              }}
            >
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
    </div>
  );
};

export default WordCloud;

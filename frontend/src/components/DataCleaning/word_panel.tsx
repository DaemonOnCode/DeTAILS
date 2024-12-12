import { FC, useState } from "react";

interface WordPanelProps {
  title: string;
  words: string[];
  onDropWord: (word: string) => void;
}

const WordPanel: FC<WordPanelProps> = ({ title, words, onDropWord }) => {
  const [searchValue, setSearchValue] = useState<string>("");

  const filteredWords = words.filter((word) =>
    word.toLowerCase().includes(searchValue.toLowerCase())
  );

  const handleDragStart = (e: React.DragEvent, word: string) => {
    e.dataTransfer.setData("text/plain", word);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const word = e.dataTransfer.getData("text/plain");
    if (word) {
      onDropWord(word);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div
      className="flex-1 p-4 bg-white border-b border-gray-300"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="mb-4">
        <input
          type="text"
          placeholder={`Search ${title.toLowerCase()}...`}
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          className="w-full border rounded p-2"
        />
      </div>
      <div className="h-60 overflow-auto bg-gray-100 border rounded p-2">
        {filteredWords.length > 0 ? (
          filteredWords.map((word, index) => (
            <div
              key={index}
              className="py-1 px-2 bg-white rounded mb-1 cursor-move"
              draggable
              onDragStart={(e) => handleDragStart(e, word)}
            >
              {word}
            </div>
          ))
        ) : (
          <p className="text-gray-500 text-sm">No matching words found</p>
        )}
      </div>
    </div>
  );
};

export default WordPanel;

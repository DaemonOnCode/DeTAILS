import { FC, useState } from "react";

interface WordPanelProps {
  title: string;
  words: string[];
}

const WordPanel: FC<WordPanelProps> = ({ title, words }) => {
  const [searchValue, setSearchValue] = useState<string>("");

  // Filtered words based on the search value
  const filteredWords = words.filter((word) =>
    word.toLowerCase().includes(searchValue.toLowerCase())
  );

  return (
    <div className="flex-1 p-4 bg-white border-b border-gray-300">
      {/* Search Field */}
      <div className="mb-4">
        <input
          type="text"
          placeholder={`Search ${title.toLowerCase()}...`}
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          className="w-full border rounded p-2"
        />
      </div>
      {/* Filtered Word List */}
      <div className="h-60 overflow-auto bg-gray-100 border rounded p-2">
        {filteredWords.length > 0 ? (
          filteredWords.map((word, index) => (
            <div
              key={index}
              className="py-1 px-2 bg-white rounded mb-1"
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

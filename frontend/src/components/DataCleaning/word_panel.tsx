import { FC, useState } from "react";

export interface WordDetail {
  token: string;
  pos: string;
  count_words: number;
  count_docs: number;
  tfidf_min: number;
  tfidf_max: number;
}

interface WordPanelProps {
  title: string;
  words: WordDetail[]; // Updated to accept detailed word data
  onDropWord: (word: WordDetail) => void;
}

const WordPanel: FC<WordPanelProps> = ({ title, words, onDropWord }) => {
  const [searchValue, setSearchValue] = useState<string>("");

  // Filter words based on the search input
  const filteredWords = words.filter((word) =>
    word.token.toLowerCase().includes(searchValue.toLowerCase())
  );

  const handleDragStart = (e: React.DragEvent, word: WordDetail) => {
    e.dataTransfer.setData("application/json", JSON.stringify(word));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const wordData = e.dataTransfer.getData("application/json");
    if (wordData) {
      const word = JSON.parse(wordData) as WordDetail;
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
              className="py-2 px-3 bg-white rounded mb-2 shadow-sm cursor-move border hover:shadow-md"
              draggable
              onDragStart={(e) => handleDragStart(e, word)}
            >
              <div className="font-semibold">{word.token}</div>
              <div className="text-sm text-gray-600">
                <p>
                  <strong>POS:</strong> {word.pos}
                </p>
                <p>
                  <strong># of Words:</strong> {word.count_words}
                </p>
                <p>
                  <strong># of Docs:</strong> {word.count_docs}
                </p>
                <p>
                  <strong>TF-IDF Min:</strong> {word.tfidf_min.toFixed(4)}
                </p>
                <p>
                  <strong>TF-IDF Max:</strong> {word.tfidf_max.toFixed(4)}
                </p>
              </div>
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

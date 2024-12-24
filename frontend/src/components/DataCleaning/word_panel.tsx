import { FC, useState } from 'react';

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
    words: WordDetail[];
    onDropWord: (word: WordDetail) => void;
}

const WordPanel: FC<WordPanelProps> = ({ title, words, onDropWord }) => {
    const [searchValue, setSearchValue] = useState<string>('');

    // Filter words based on the search input
    const filteredWords = words.filter((word) =>
        word.token.toLowerCase().includes(searchValue.toLowerCase())
    );

    const handleDragStart = (e: React.DragEvent, word: WordDetail) => {
        e.dataTransfer.setData('application/json', JSON.stringify(word));
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const wordData = e.dataTransfer.getData('application/json');
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
            className="px-2 bg-white border-b border-gray-300"
            onDragOver={handleDragOver}
            onDrop={handleDrop}>
            <div className="mb-4">
                <input
                    type="text"
                    placeholder={`Search ${title.toLowerCase()}...`}
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    className="w-full border rounded p-2"
                />
            </div>
            <div className="overflow-auto max-h-[calc((100vh-64px-48px-210px)/2)] bg-gray-100 border rounded">
                {filteredWords.length > 0 ? (
                    <table className="table-auto w-full bg-white border border-gray-300">
                        <thead>
                            <tr className="bg-gray-200">
                                <th className="px-4 py-2 text-left">Token</th>
                                <th className="px-4 py-2 text-left">POS</th>
                                <th className="px-4 py-2 text-left"># of Words</th>
                                <th className="px-4 py-2 text-left"># of Docs</th>
                                <th className="px-4 py-2 text-left">TF-IDF Min</th>
                                <th className="px-4 py-2 text-left">TF-IDF Max</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredWords.map((word, index) => (
                                <tr
                                    key={index}
                                    className="border-t hover:bg-gray-100"
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, word)}>
                                    <td className="px-4 py-2">{word.token}</td>
                                    <td className="px-4 py-2">{word.pos}</td>
                                    <td className="px-4 py-2">{word.count_words}</td>
                                    <td className="px-4 py-2">{word.count_docs}</td>
                                    <td className="px-4 py-2">{word.tfidf_min.toFixed(4)}</td>
                                    <td className="px-4 py-2">{word.tfidf_max.toFixed(4)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <p className="text-gray-500 text-sm">No matching words found</p>
                )}
            </div>
        </div>
    );
};

export default WordPanel;

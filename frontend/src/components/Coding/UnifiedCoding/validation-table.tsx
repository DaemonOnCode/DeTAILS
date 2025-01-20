import { FC } from 'react';

interface ValidationTableProps {
    codeResponses: {
        postId: string;
        sentence: string;
        coded_word: string;
        theme?: string;
    }[];
    onViewTranscript: (postId: string) => void;
    review: boolean;
    showThemes?: boolean; // New prop to conditionally show the Themes column
}

const ValidationTable: FC<ValidationTableProps> = ({
    codeResponses,
    onViewTranscript,
    review,
    showThemes
}) => {
    // Group data by postId
    const groupedData = codeResponses.reduce<{ [key: string]: any[] }>((acc, item) => {
        if (!acc[item.postId]) {
            acc[item.postId] = [];
        }
        acc[item.postId].push(item);
        return acc;
    }, {});

    return (
        <div className="p-6 overflow-auto">
            <h2 className="text-xl font-bold mb-4">
                {review ? 'Coding Review' : 'Coding Validation'}
            </h2>
            <table className="w-full border-collapse border border-gray-300">
                <thead>
                    <tr className="bg-gray-200">
                        <th className="border p-2">Link</th>
                        <th className="border p-2">Sentence</th>
                        <th className="border p-2">Coded Word</th>
                        {showThemes && <th className="border p-2">Theme</th>}
                        {!review && <th className="border p-2">Actions</th>}
                    </tr>
                </thead>
                <tbody>
                    {Object.keys(groupedData).map((postId) => {
                        const rows = groupedData[postId];
                        return rows.map((row, index) => (
                            <tr key={`${postId}-${index}`}>
                                {index === 0 ? (
                                    <td
                                        rowSpan={rows.length}
                                        className="border p-2 text-center align-middle">
                                        <button
                                            className="text-blue-500 underline"
                                            onClick={() => onViewTranscript(postId)}>
                                            {postId}
                                        </button>
                                    </td>
                                ) : null}
                                <td className="border p-2">{row.sentence}</td>
                                <td className="border p-2">{row.coded_word}</td>
                                {showThemes && (
                                    <td className="border p-2">
                                        {row.theme || (
                                            <span className="text-gray-400 italic">
                                                No theme assigned
                                            </span>
                                        )}
                                    </td>
                                )}
                                {!review && (
                                    <td className="border p-2 flex gap-2">
                                        <button
                                            className="bg-green-500 text-white px-2 py-1 rounded"
                                            onClick={() => console.log('Correct', row)}>
                                            ✓ Correct
                                        </button>
                                        <button
                                            className="bg-red-500 text-white px-2 py-1 rounded"
                                            onClick={() => console.log('Wrong', row)}>
                                            ✕ Wrong
                                        </button>
                                        <button
                                            className="bg-gray-500 text-white px-2 py-1 rounded"
                                            onClick={() => console.log('Delete', row)}>
                                            🗑 Delete
                                        </button>
                                    </td>
                                )}
                            </tr>
                        ));
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default ValidationTable;

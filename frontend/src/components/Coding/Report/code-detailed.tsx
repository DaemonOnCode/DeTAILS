import React, { useMemo } from 'react';

export interface CodeDetailRow {
    id: string;
    postId: string;
    code: string;
    higherLevelCode: string;
    theme: string;
    quote: string;
    explanation: string;
}

interface Props {
    rows: CodeDetailRow[];
    onViewPost: (postId: string, sentence: string) => void;
}

export const CodeDetailedTable: React.FC<Props> = ({ rows, onViewPost }) => {
    const grouped = useMemo(() => {
        return rows.reduce<Record<string, CodeDetailRow[]>>((acc, r) => {
            (acc[r.code] ||= []).push(r);
            return acc;
        }, {});
    }, [rows]);

    return (
        <table className="w-full border-separate border-spacing-0">
            <thead className="sticky top-0 bg-gray-200 border-b-2 border-gray-400">
                <tr>
                    <th className="p-2 border">Post ID</th>
                    <th className="p-2 border">Quote</th>
                    <th className="p-2 border">Explanation</th>
                </tr>
            </thead>

            {Object.entries(grouped).map(([code, items]) => {
                const theme = items[0]?.theme || 'Unknown';
                return (
                    <tbody key={code}>
                        <tr className="sticky top-[38px] bg-gray-50 border-b border-gray-300 z-10">
                            <td colSpan={3} className="p-2 font-semibold bg-gray-50">
                                Code: {code}{' '}
                                <span className="text-sm text-gray-600">(Theme: {theme})</span>
                            </td>
                        </tr>
                        {items.map((item) => (
                            <tr key={item.id} className="hover:bg-gray-50">
                                <td className="p-2 border">
                                    <button
                                        onClick={() => onViewPost(item.postId, item.quote)}
                                        className="text-blue-500 underline">
                                        {item.postId}
                                    </button>
                                </td>
                                <td className="p-2 border overflow-wrap">{item.quote}</td>
                                <td className="p-2 border overflow-wrap">{item.explanation}</td>
                            </tr>
                        ))}
                    </tbody>
                );
            })}
        </table>
    );
};

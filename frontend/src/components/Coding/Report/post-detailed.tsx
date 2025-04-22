import React, { useMemo } from 'react';

export interface PostDetailRow {
    id: string;
    postId: string;
    code: string;
    higherLevelCode: string;
    theme: string;
    quote: string;
    explanation: string;
}

interface Props {
    rows: PostDetailRow[];
    onViewPost: (postId: string, sentence: string) => void;
}

export const PostDetailedTable: React.FC<Props> = ({ rows, onViewPost }) => {
    // group by postId
    const grouped = useMemo(() => {
        return rows.reduce<Record<string, PostDetailRow[]>>((acc, r) => {
            (acc[r.postId] ||= []).push(r);
            return acc;
        }, {});
    }, [rows]);

    return (
        <table className="w-full border-separate border-spacing-0">
            <thead className="sticky top-0 bg-gray-200 border-b-2 border-gray-400">
                <tr>
                    <th className="p-2 border">Code</th>
                    <th className="p-2 border">Theme</th>
                    <th className="p-2 border">Quote</th>
                    <th className="p-2 border">Explanation</th>
                </tr>
            </thead>

            {Object.entries(grouped).map(([postId, items]) => (
                <tbody key={postId}>
                    <tr className="sticky top-[38px] bg-gray-50 border-b border-gray-300 z-10">
                        <td colSpan={4} className="p-2 font-semibold bg-gray-50">
                            <button
                                onClick={() => onViewPost(postId, '')}
                                className="text-blue-500 underline">
                                Post ID: {postId}
                            </button>
                        </td>
                    </tr>
                    {items.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                            <td className="p-2 border">{item.code}</td>
                            <td className="p-2 border">{item.theme}</td>
                            <td className="p-2 border">{item.quote}</td>
                            <td className="p-2 border">{item.explanation}</td>
                        </tr>
                    ))}
                </tbody>
            ))}
        </table>
    );
};

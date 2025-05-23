import React from 'react';

export interface CodeSummaryRow {
    theme: string;
    uniquePosts: number;
    uniqueCodes: number;
    totalQuoteCount: number;
}

export interface OverallStats {
    totalUniquePosts: number;
    totalUniqueCodes: number;
    totalQuoteCount: number;
}

export interface Meta {
    totalItems: number;
    hasNext: boolean;
    hasPrevious: boolean;
}

interface Props {
    rows: CodeSummaryRow[];
    overallStats: OverallStats | null;
}

export const CodeSummaryTable: React.FC<Props> = ({ rows, overallStats }) => {
    return (
        <div className="flex flex-col">
            <div className="relative mb-4">
                <table className="w-full border-separate border-spacing-0 mb-6 rounded-lg">
                    <thead className="sticky top-0 z-30 bg-gray-200 border-b-2 border-gray-400 shadow-md">
                        <tr>
                            <th className="p-2 border border-gray-400 bg-gray-200">Theme</th>
                            <th className="p-2 border border-gray-400 bg-gray-200">Posts</th>
                            <th className="p-2 border border-gray-400 bg-gray-200">Unique Codes</th>
                            <th className="p-2 border border-gray-400 bg-gray-200">Total Quotes</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r) => (
                            <tr key={r.theme} className="hover:bg-gray-50">
                                <td className="p-2 border border-gray-400">{r.theme}</td>
                                <td className="p-2 border border-gray-400">{r.uniquePosts}</td>
                                <td className="p-2 border border-gray-400">{r.uniqueCodes}</td>
                                <td className="p-2 border border-gray-400">{r.totalQuoteCount}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="p-4 border border-gray-300 rounded-lg">
                <h3 className="text-lg font-semibold mb-2">Quick Stats</h3>
                <div className="flex flex-col space-y-2">
                    <div>Total Unique Posts: {overallStats?.totalUniquePosts ?? '-'}</div>
                    <div>Total Unique Codes: {overallStats?.totalUniqueCodes ?? '-'}</div>
                    <div>Total Quote Count: {overallStats?.totalQuoteCount ?? '-'}</div>
                </div>
            </div>
        </div>
    );
};

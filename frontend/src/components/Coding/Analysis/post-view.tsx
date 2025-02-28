import { PostViewProps } from '../../../types/Coding/props';

const PostView = ({
    allPostIds,
    grouped,
    handleViewPost,
    totalColumns = 4,
    summaryView = false
}: PostViewProps) => {
    if (summaryView) {
        const summaryData = allPostIds.map((pid) => {
            const rows = grouped[pid];
            const uniqueThemes = new Set(rows.map((row) => row.theme));
            const uniqueCodes = new Set(rows.map((row) => row.coded_word));
            const totalQuoteCount = rows.length;
            return {
                postId: pid,
                uniqueThemeCount: uniqueThemes.size,
                uniqueCodeCount: uniqueCodes.size,
                totalQuoteCount
            };
        });

        const overallThemes = new Set<string>();
        const overallCodes = new Set<string>();
        let overallQuoteCount = 0;
        allPostIds.forEach((pid) => {
            const rows = grouped[pid];
            rows.forEach((row) => {
                overallThemes.add(row.theme);
                overallCodes.add(row.coded_word);
            });
            overallQuoteCount += rows.length;
        });

        return (
            <div className="flex flex-col h-full">
                <div className="relative mb-4 flex-1 min-h-0 overflow-auto">
                    <table className="w-full border-separate border-spacing-0 mb-6 rounded-lg">
                        <thead className="sticky top-0 z-30 bg-gray-200 border-b-2 border-gray-400 shadow-md">
                            <tr>
                                <th className="p-2 border border-gray-400 bg-gray-200">Post ID</th>
                                <th className="p-2 border border-gray-400 bg-gray-200">
                                    Unique Theme Count
                                </th>
                                <th className="p-2 border border-gray-400 bg-gray-200">
                                    Unique Code Count
                                </th>
                                <th className="p-2 border border-gray-400 bg-gray-200">
                                    Total Quote Count
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {summaryData.map((data) => (
                                <tr key={data.postId} className="hover:bg-gray-50">
                                    <td className="p-2 border border-gray-400">
                                        <button
                                            onClick={() => handleViewPost(data.postId, '')}
                                            className="text-blue-500 underline">
                                            Post ID: {data.postId}
                                        </button>
                                    </td>
                                    <td className="p-2 border border-gray-400">
                                        {data.uniqueThemeCount}
                                    </td>
                                    <td className="p-2 border border-gray-400">
                                        {data.uniqueCodeCount}
                                    </td>
                                    <td className="p-2 border border-gray-400">
                                        {data.totalQuoteCount}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="p-4 border border-gray-300 rounded-lg">
                        <h3 className="text-lg font-semibold mb-2">Quick Stats</h3>
                        <div className="flex flex-col space-y-2">
                            <div>Total Unique Themes: {overallThemes.size}</div>
                            <div>Total Unique Codes: {overallCodes.size}</div>
                            <div>Total Quote Count: {overallQuoteCount}</div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full relative">
            <div className="flex-1 min-h-0 overflow-auto">
                <table className="w-full border-separate border-spacing-0 relative rounded-lg">
                    <thead className="sticky top-0 z-30 bg-gray-200 border-b-2 border-gray-400 shadow-md">
                        <tr>
                            <th className="p-2 border border-gray-400 bg-gray-200 outline outline-1 outline-gray-400">
                                Code
                            </th>
                            <th className="p-2 border border-gray-400 bg-gray-200 outline outline-1 outline-gray-400">
                                Theme
                            </th>
                            <th className="p-2 border border-gray-400 bg-gray-200 outline outline-1 outline-gray-400">
                                Quote
                            </th>
                            <th className="p-2 border border-gray-400 bg-gray-200 outline outline-1 outline-gray-400">
                                Explanation
                            </th>
                        </tr>
                    </thead>

                    {allPostIds.map((pid) => {
                        const rows = grouped[pid];
                        return (
                            <tbody key={pid}>
                                <tr className="sticky top-[38px] bg-gray-50 z-20 border-b border-gray-300">
                                    <td
                                        colSpan={totalColumns}
                                        className="p-2 font-semibold border border-gray-300 outline outline-1 outline-gray-300 bg-gray-50">
                                        <button
                                            onClick={() => handleViewPost(pid, '')}
                                            className="text-blue-500 underline">
                                            Post ID: {pid}
                                        </button>
                                    </td>
                                </tr>

                                {rows.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50">
                                        <td className="border border-gray-400 p-2 max-w-32">
                                            {item.coded_word}
                                        </td>
                                        <td className="border border-gray-400 p-2 max-w-32">
                                            {item.theme}
                                        </td>
                                        <td className="border border-gray-400 p-2 max-w-md">
                                            {item.quote}
                                        </td>
                                        <td className="border border-gray-400 p-2 min-w-96">
                                            {item.reasoning}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        );
                    })}
                </table>
            </div>
        </div>
    );
};

export default PostView;

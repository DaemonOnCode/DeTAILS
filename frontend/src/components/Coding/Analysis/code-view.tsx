import { CodeViewProps } from '../../../types/Coding/props';
import { PostItem } from '../../../types/Coding/shared';

const CodeView = ({
    allCodes,
    groupedByCode,
    summaryView = false,
    totalColumns = 4,
    handleViewPost
}: CodeViewProps) => {
    if (summaryView) {
        const themeGroups: Record<string, PostItem[]> = {};
        allCodes.forEach((code) => {
            const rows = groupedByCode[code];
            rows.forEach((item) => {
                const theme = item.theme;
                if (!themeGroups[theme]) {
                    themeGroups[theme] = [];
                }
                themeGroups[theme].push(item);
            });
        });

        const summaryData = Object.keys(themeGroups).map((themeName) => {
            const items = themeGroups[themeName];
            const uniquePostsCount = new Set(items.map((item) => item.postId)).size;
            const totalCodeCount = items.length;
            const totalQuoteCount = items.length;
            return {
                themeName,
                uniquePostsCount,
                totalCodeCount,
                totalQuoteCount
            };
        });

        // Compute overall quick stats across themes
        const overallUniqueThemesCount = Object.keys(themeGroups).length;
        const overallUniquePostsSet = new Set<string>();
        let overallTotalCodeCount = 0;
        summaryData.forEach((data) => {
            overallTotalCodeCount += data.totalCodeCount;
            themeGroups[data.themeName].forEach((item) => {
                overallUniquePostsSet.add(item.postId);
            });
        });
        const overallUniquePostsCount = overallUniquePostsSet.size;

        return (
            <div className="flex flex-col h-full">
                <div className="relative mb-4 flex-1 min-h-0 overflow-auto">
                    <table className="w-full border-collapse mb-6 rounded-lg">
                        <thead className="sticky top-0 z-30 bg-gray-200 border-b-2 border-gray-400 shadow-md">
                            <tr>
                                <th className="p-2 border border-gray-400 bg-gray-200">
                                    Theme Name
                                </th>
                                <th className="p-2 border border-gray-400 bg-gray-200">
                                    Unique Posts Count
                                </th>
                                <th className="p-2 border border-gray-400 bg-gray-200">
                                    Total Code Count
                                </th>
                                <th className="p-2 border border-gray-400 bg-gray-200">
                                    Total Quote Count
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {summaryData.map((data) => (
                                <tr key={data.themeName} className="hover:bg-gray-50">
                                    <td className="p-2 border border-gray-400">{data.themeName}</td>
                                    <td className="p-2 border border-gray-400">
                                        {data.uniquePostsCount}
                                    </td>
                                    <td className="p-2 border border-gray-400">
                                        {data.totalCodeCount}
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
                            <div>Total Unique Themes: {overallUniqueThemesCount}</div>
                            <div>Total Unique Posts: {overallUniquePostsCount}</div>
                            <div>Total Code Count: {overallTotalCodeCount}</div>
                            <div>Total Quote Count: {overallTotalCodeCount}</div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full relative">
            <div className="flex-1 min-h-0 overflow-auto">
                <table className="w-full border-collapse relative  rounded-lg">
                    <thead className="sticky top-0 z-30 bg-gray-200 border-b-2 border-gray-400 shadow-md">
                        <tr>
                            <th className="p-2 border border-gray-400 bg-gray-200">Post ID</th>
                            <th className="p-2 border border-gray-400 bg-gray-200">Quote</th>
                            <th className="p-2 border border-gray-400 bg-gray-200">Explanation</th>
                        </tr>
                    </thead>
                    {allCodes.map((code) => {
                        const rows = groupedByCode[code];
                        const theme = rows[0]?.theme || 'Unknown Theme';
                        return (
                            <tbody key={code}>
                                <tr className="sticky top-[38px] bg-gray-50 z-20 border-b border-gray-300">
                                    <td
                                        colSpan={totalColumns}
                                        className="p-2 font-semibold border border-gray-300 outline outline-1 outline-gray-300 bg-gray-50">
                                        <span className="mr-2">Code: {code}</span>
                                        <span className="text-sm text-gray-600">
                                            (Theme: {theme})
                                        </span>
                                    </td>
                                </tr>

                                {rows.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50">
                                        <td className="border border-gray-400 p-2">
                                            <button
                                                onClick={() =>
                                                    handleViewPost(item.postId, item.quote)
                                                }
                                                className="text-blue-500 underline">
                                                {item.postId}
                                            </button>
                                        </td>
                                        <td className="border border-gray-400 p-2">{item.quote}</td>
                                        <td className="border border-gray-400 p-2">
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

export default CodeView;

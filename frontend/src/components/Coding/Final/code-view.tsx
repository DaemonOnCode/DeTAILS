const CodeView = ({
    allCodes,
    groupedByCode,
    totalColumns,
    handleViewPost
}: {
    allCodes: string[];
    groupedByCode: Record<
        string,
        {
            postId: string;
            quote: string;
            coded_word: string;
            reasoning: string;
            theme: string;
            id: string;
        }[]
    >;
    totalColumns: number;
    handleViewPost: (postId: string, sentence: string) => void;
}) => {
    return (
        <div className="relative border border-gray-300 rounded-lg">
            {/* Scrollable area */}
            <div className="overflow-auto max-h-[calc(100vh-15rem)]">
                <table className="w-full border-collapse relative">
                    {/* Sticky main table header: Post ID, Quote, Explanation */}
                    <thead className="sticky top-0 z-30 bg-gray-200 border-b-2 border-gray-400 shadow-md">
                        <tr>
                            <th className="p-2 border border-gray-400 bg-gray-200">Post ID</th>
                            <th className="p-2 border border-gray-400 bg-gray-200">Quote</th>
                            <th className="p-2 border border-gray-400 bg-gray-200">Explanation</th>
                        </tr>
                    </thead>

                    {/* For each code group, render a subheader row and then the group's rows */}
                    {allCodes.map((code) => {
                        const rows = groupedByCode[code];
                        // Use the first row's theme for the group header
                        const theme = rows[0]?.theme || 'Unknown Theme';
                        return (
                            <tbody key={code}>
                                {/* Subheader row for Code, sticky below main thead */}
                                <tr className="sticky top-[38px] bg-gray-50 z-20 border-b border-gray-300">
                                    <td
                                        colSpan={totalColumns}
                                        className="p-2 font-semibold border border-gray-300  outline outline-1 outline-gray-300 bg-gray-50">
                                        <span className="mr-2">Code: {code}</span>
                                        <span className="text-sm text-gray-600">
                                            (Theme: {theme})
                                        </span>
                                    </td>
                                </tr>

                                {/* Rows for this code */}
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

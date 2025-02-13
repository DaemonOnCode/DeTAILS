const PostView = ({
    allPostIds,
    grouped,
    handleViewPost,
    totalColumns = 4
}: {
    allPostIds: string[];
    grouped: Record<
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
    handleViewPost: (postId: string, sentence: string) => void;
    totalColumns?: number;
}) => {
    return (
        <div className="relative border border-gray-300 rounded-lg">
            {/* Scrollable area */}
            <div className="overflow-auto max-h-[calc(100vh-15rem)]">
                <table className="w-full border-collapse relative">
                    {/* Sticky main table header: Code, Theme, Quote, Explanation */}
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

                    {/* For each postId group, render a subheader row and the group's rows */}
                    {allPostIds.map((pid) => {
                        const rows = grouped[pid];
                        return (
                            <tbody key={pid}>
                                {/* Subheader row for Post ID, sticky below main thead.
                        Adjust top offset if your thead is larger or smaller. */}
                                <tr className="sticky top-[38px] bg-gray-50 z-20 border-b border-gray-300">
                                    <td
                                        colSpan={totalColumns}
                                        className="p-2 font-semibold border border-gray-300 outline outline-1 outline-gray-300 bg-gray-50">
                                        <button
                                            onClick={() => {
                                                handleViewPost(pid, '');
                                            }}
                                            className="text-blue-500 underline">
                                            Post ID: {pid}
                                        </button>
                                    </td>
                                </tr>

                                {/* Rows for this postId */}
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

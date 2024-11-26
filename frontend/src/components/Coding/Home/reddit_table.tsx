import { FC, useState } from 'react';
import { RedditPosts } from '../../../types/Coding/shared';
import RedditViewModal from '../Shared/reddit_view_modal';
import { RedditTableProps } from '../../../types/Coding/props';

const RedditTable: FC<RedditTableProps> = ({
    data,
    selectedPosts,
    togglePostSelection,
    toggleSelectPage
}) => {
    const [selectedPost, setSelectedPost] = useState<(typeof data)[number] | null>(null);

    // Check if all posts on the current page are selected
    const areAllPagePostsSelected = data.every(([id]) => selectedPosts.includes(id));

    return (
        <div className="overflow-x-auto">
            <table className="max-w-full border border-gray-300">
                <thead className="bg-gray-100">
                    <tr>
                        <th className="px-4 py-2 border">
                            <input
                                type="checkbox"
                                onChange={() => toggleSelectPage(data)}
                                checked={areAllPagePostsSelected}
                            />
                        </th>
                        <th className="px-4 py-2 border">URL</th>
                        <th className="px-4 py-2 border">Created UTC</th>
                        <th className="px-4 py-2 border">Title</th>
                        <th className="px-4 py-2 border">Text</th>
                    </tr>
                </thead>
                <tbody>
                    {data.map((post, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-2 border">
                                <input
                                    type="checkbox"
                                    checked={selectedPosts.includes(post[0])}
                                    onChange={() => togglePostSelection(post[0])}
                                />
                            </td>
                            <td className="px-4 py-2 border">
                                <p
                                    className="text-blue-500 underline cursor-pointer"
                                    onClick={() => setSelectedPost(post)}>
                                    {post[0]}
                                </p>
                            </td>
                            <td className="px-4 py-2 border">
                                {new Date(post[1].created_utc * 1000).toLocaleString()}
                            </td>
                            <td className="px-4 py-2 border">{post[1].title}</td>
                            <td className="px-4 py-2 border">{post[1].selftext}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {selectedPost && (
                <RedditViewModal
                    isViewOpen={selectedPost !== null}
                    postLink={selectedPost[1].url || selectedPost[1].permalink}
                    postText={selectedPost[1].selftext}
                    closeModal={() => setSelectedPost(null)}
                />
            )}
        </div>
    );
};

export default RedditTable;

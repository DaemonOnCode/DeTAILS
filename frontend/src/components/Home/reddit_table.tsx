import { FC, useState } from 'react';
import { RedditPosts } from '../../types/shared';
import RedditViewModal from '../Shared/reddit_view_modal';

type RedditTableProps = {
    data: [string, RedditPosts[string]][];
};

const RedditTable: FC<RedditTableProps> = ({ data }) => {
    const [selectedPost, setSelectedPost] = useState<(typeof data)[number] | null>(null);
    return (
        <div className="overflow-x-auto">
            <table className="max-w-full border border-gray-300">
                <thead className="bg-gray-100">
                    <tr>
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
                                <p
                                    className="text-blue-500 underline cursor-pointer"
                                    onClick={() => setSelectedPost(post)}>
                                    {post[0]}
                                </p>
                            </td>
                            <td className="px-4 py-2 border">{post[1].created_utc}</td>
                            <td className="px-4 py-2 border">{post[1].title}</td>
                            <td className="px-4 py-2 border">{post[1].selftext}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {selectedPost && (
                <RedditViewModal
                    isViewOpen={selectedPost !== null}
                    postLink={selectedPost[1].url}
                    postText={selectedPost[1].selftext}
                    closeModal={() => setSelectedPost(null)}
                />
            )}
        </div>
    );
};

export default RedditTable;

import { FC, useState } from 'react';
import { RedditPost } from '../../types/shared';
import RedditViewModal from '../Shared/reddit_view_modal';

type RedditTableProps = {
    data: RedditPost[];
};

const RedditTable: FC<RedditTableProps> = ({ data }) => {
    const [selectedPost, setSelectedPost] = useState<RedditPost | null>(null);
    return (
        <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-300">
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
                                    {post.id}
                                </p>
                            </td>
                            <td className="px-4 py-2 border">{post.created_utc}</td>
                            <td className="px-4 py-2 border">{post.title}</td>
                            <td className="px-4 py-2 border">{post.selftext}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {selectedPost && (
                <RedditViewModal
                    isViewOpen={selectedPost !== null}
                    postLink={selectedPost.url}
                    postText={selectedPost.selftext}
                    closeModal={() => setSelectedPost(null)}
                />
            )}
        </div>
    );
};

export default RedditTable;

import { FC } from 'react';

interface PostCardsProps {
    resource: {
        read(): any;
    };
    postStates?: { [postId: string]: boolean }; // Optional prop
    onPostClick: (postId: string) => void;
}

const PostCards: FC<PostCardsProps> = ({ resource, postStates, onPostClick }) => {
    const postIdTitles = resource.read();

    if (!postIdTitles || postIdTitles.length === 0) {
        return <p>No posts available</p>;
    }

    return (
        <div className="p-4 grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {postIdTitles.map((post: { id: string; title: string; selftext: string }) => {
                const isDone = postStates?.[post.id] ?? false;
                return (
                    <div
                        key={post.id}
                        className={`relative p-4 border rounded shadow transition-all transform hover:scale-105 hover:shadow-2xl cursor-pointer duration-300 ease-in-out h-48 ${isDone ? 'bg-green-100 hover:bg-green-200' : 'bg-white hover:bg-blue-100'}`}
                        onClick={() => onPostClick(post.id)}>
                        {isDone && (
                            <span className="absolute top-2 right-2 text-green-500">✔️</span>
                        )}
                        <h3 className="text-lg font-bold mb-2 truncate">{post.title}</h3>
                        <p className="text-gray-600 line-clamp-5">
                            {post.selftext || (
                                <span className="text-gray-400 italic">
                                    No additional text available
                                </span>
                            )}
                        </p>
                    </div>
                );
            })}
        </div>
    );
};

export default PostCards;

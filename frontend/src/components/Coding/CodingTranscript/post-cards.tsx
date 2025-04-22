import { FC, memo } from 'react';
import { FaCheck } from 'react-icons/fa';

interface PostCardsProps {
    postData: { id: string; title: string; selftext: string }[];
    postStates?: { [postId: string]: boolean };
    onPostClick: (postId: string) => void;
}

const PostCards: FC<PostCardsProps> = memo(({ postData, postStates, onPostClick }) => {
    if (!postData || postData.length === 0) {
        return <p>No posts available</p>;
    }

    return (
        <div className="p-4 grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {postData.map((post) => {
                const isDone = postStates?.[post.id] ?? false;
                return (
                    <div
                        key={post.id}
                        className={`relative p-4 border ${
                            isDone ? 'border-green-500' : 'border-gray-300'
                        } rounded shadow transition-all transform hover:scale-105 hover:shadow-2xl cursor-pointer duration-300 ease-in-out h-48 ${
                            isDone
                                ? 'bg-green-100 hover:bg-green-200'
                                : 'bg-white hover:bg-blue-100'
                        }`}
                        onClick={() => onPostClick(post.id)}>
                        <div className="flex items-center mb-2">
                            {!!isDone && <FaCheck className="text-green-500 text-xl mr-2" />}
                            <h3 className="text-lg font-bold truncate">{post.title}</h3>
                        </div>
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
});

export default PostCards;

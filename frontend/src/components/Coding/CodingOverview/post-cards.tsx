import { FC } from 'react';

interface PostCardsProps {
    resource: {
        read(): any;
    };
    onPostClick: (postId: string) => void;
}

const PostCards: FC<PostCardsProps> = ({ resource, onPostClick }) => {
    const postIdTitles = resource.read();

    console.count('Post Cards Render');

    return (
        <div className="p-4 grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {postIdTitles.map((post: { id: string; title: string; selftext: string }) => (
                <div
                    key={post.id}
                    className="p-4 border rounded shadow transition-all transform hover:scale-105 hover:shadow-2xl bg-white hover:bg-blue-100 cursor-pointer duration-300 ease-in-out break-words"
                    onClick={() => onPostClick(post.id)}>
                    <h3 className="text-lg font-bold mb-2">{post.title}</h3>
                    {post.selftext ? (
                        <p className="text-gray-600">{post.selftext}</p>
                    ) : (
                        <p className="text-gray-400 italic">No additional text available</p>
                    )}
                </div>
            ))}
        </div>
    );
};

export default PostCards;

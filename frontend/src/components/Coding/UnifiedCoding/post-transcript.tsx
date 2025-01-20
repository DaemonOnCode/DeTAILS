import { FC } from 'react';

interface PostTranscriptProps {
    post: { id: string; title: string; selftext: string; comments: any[] } | null;
    onBack: () => void;
    review: boolean;
}

const PostTranscript: FC<PostTranscriptProps> = ({ post, onBack, review }) => {
    if (!post) return <div>No post selected</div>;

    const handleCodeSelection = () => {
        if (!review) {
            alert('Code applied to text!');
        }
    };

    return (
        <div className="p-6">
            <button onClick={onBack} className="mb-4 text-blue-500">
                &lt;- <span className="underline">Back to Posts</span>
            </button>

            <h2 className="text-xl font-bold">{post.title}</h2>
            <p className="text-gray-700 my-4">{post.selftext}</p>

            <h3 className="text-lg font-semibold">Comments</h3>
            {post.comments.map((comment, index) => (
                <p
                    key={index}
                    className={`p-2 border rounded ${!review ? 'cursor-pointer hover:bg-yellow-200' : ''}`}
                    onClick={!review ? handleCodeSelection : undefined}>
                    {comment.body}
                </p>
            ))}
        </div>
    );
};

export default PostTranscript;

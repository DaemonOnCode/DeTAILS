import { FC } from 'react';

interface Comment {
    id: string;
    body: string;
    comments?: Comment[];
}

const RedditComments: FC<{ comments: Comment[] }> = ({ comments }) => {
    if (!comments || comments.length === 0) return <p>No comments available</p>;

    return (
        <div className="mt-4">
            {comments.map((comment) => (
                <div key={comment.id} className="border-l-2 pl-4 mb-2">
                    <p>{comment.body}</p>
                    {comment.comments && <RedditComments comments={comment.comments} />}
                </div>
            ))}
        </div>
    );
};

export default RedditComments;

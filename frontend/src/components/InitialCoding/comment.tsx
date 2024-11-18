import { IComment } from '../../types/shared';

const Comment = ({ comment, level = 0 }: { comment: IComment; level?: number }) => {
    return (
        <div className={`mb-6`} style={{ marginLeft: `${level * 20}px` }}>
            <p className={`mb-4`}>{comment.body}</p>
            {comment.comments && comment.comments.length > 0 && (
                <div className="mt-1">
                    {comment.comments.map((reply) => (
                        <Comment key={reply.id} comment={reply} level={level + 1} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default Comment;

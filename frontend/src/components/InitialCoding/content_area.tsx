import { FC } from "react";
import { IRedditPostData, IReference } from "../../types/shared";
import Comment from "./comment";

interface ContentAreaProps {
  selectedPost: IRedditPostData | null;
  selectedCodeForReferences: string | null;
  references: Record<string, IReference[]>;
  handleReferenceClick: (postId: number) => void;
  handleTextSelection: () => void;
}

const ContentArea: FC<ContentAreaProps> = ({
  selectedPost,
  selectedCodeForReferences,
  references,
  handleReferenceClick,
  handleTextSelection,
}) => (
  <div className="flex-1 p-6 overflow-y-auto" onMouseUp={handleTextSelection}>
    {selectedCodeForReferences ? (
      <>
    <h2 className="text-2xl font-bold mb-6 text-gray-800">
        References for <span className="text-indigo-600">"{selectedCodeForReferences}"</span>
    </h2>
    <div className="bg-gray-50 p-6 rounded-lg shadow border border-gray-200">
        {references[selectedCodeForReferences]?.length > 0 ? (
        references[selectedCodeForReferences].map((ref, index) => (
            <div key={index} className="mb-4">
            <p className="text-gray-800 mb-1">
                {ref.text}
                <span
                className={`ml-2 px-2 py-1 text-sm font-medium rounded ${
                    ref.isComment ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"
                }`}
                >
                {ref.isComment ? "Comment" : "Post"}
                </span>
            </p>
            <button
                className="text-indigo-500 hover:text-indigo-700 font-semibold text-sm"
                onClick={() => handleReferenceClick(ref.postId)}
            >
                View Reference
            </button>
            </div>
        ))
        ) : (
        <p className="text-gray-500 italic">No references found for this code.</p>
        )}
    </div>
    </>
    ) : selectedPost ? (
        <>
            <h1 className="text-2xl font-bold mb-4">{selectedPost.title}</h1>
            <p className="mb-6">{selectedPost.body}</p>
            <h2 className="text-xl font-semibold mb-4">Transcript</h2>
            {(selectedPost.comments ?? []).map((comment) => (
                <Comment key={comment.id} comment={comment} />
            ))}
        </>
    ) : (
      <p className="text-gray-500">Select a document or code to view its details.</p>
    )}
  </div>
);

export default ContentArea;

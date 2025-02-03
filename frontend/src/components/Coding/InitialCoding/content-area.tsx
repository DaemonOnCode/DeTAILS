import { FC, useEffect } from 'react';
import Comment from './comment';
import { ContentAreaProps } from '../../../types/Coding/props';
import { IRedditPostData } from '../../../types/Coding/shared';
import { REMOTE_SERVER_ROUTES } from '../../../constants/Shared';
import { useCollectionContext } from '../../../context/collection-context';
import getServerUtils from '../../../hooks/Shared/get-server-url';

const { ipcRenderer } = window.require('electron');

const ContentArea: FC<ContentAreaProps> = ({
    selectedPost,
    selectedCodeForReferences,
    references,
    handleReferenceClick,
    handleTextSelection,
    selectedPostData,
    setSelectedPostData
}) => {
    const { datasetId } = useCollectionContext();
    const { getServerUrl } = getServerUtils();

    useEffect(() => {
        console.log('Getting post by id, content area', selectedPost);

        if (!selectedPost) {
            return;
        }
        // if (!USE_LOCAL_SERVER) {
        fetch(getServerUrl(REMOTE_SERVER_ROUTES.GET_REDDIT_POST_BY_ID), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                postId: selectedPost.id,
                datasetId: datasetId
            })
        })
            .then((response) => response.json())
            .then((data: IRedditPostData) => {
                console.log('Post data:', data);
                setSelectedPostData(data);
            });
        //     return;
        // }
        // ipcRenderer
        //     .invoke('get-post-by-id', selectedPost?.id, DB_PATH)
        //     .then((data: IRedditPostData) => {
        //         console.log('Post data:', data);
        //         setSelectedPostData(data);
        //     });
    }, [selectedPost]);
    return (
        <div className="flex-1 p-6 overflow-y-auto" onMouseUp={handleTextSelection}>
            {selectedCodeForReferences ? (
                <>
                    <h2 className="text-2xl font-bold mb-6 text-gray-800">
                        References for{' '}
                        <span className="text-indigo-600">"{selectedCodeForReferences}"</span>
                    </h2>
                    <div className="bg-gray-50 p-6 rounded-lg shadow border border-gray-200">
                        {references[selectedCodeForReferences]?.length > 0 ? (
                            references[selectedCodeForReferences].map((ref, index) => (
                                <div key={index} className="mb-4">
                                    <p className="text-gray-800 mb-1">
                                        {ref.text}
                                        <span
                                            className={`ml-2 px-2 py-1 text-sm font-medium rounded ${
                                                ref.isComment
                                                    ? 'bg-yellow-100 text-yellow-700'
                                                    : 'bg-green-100 text-green-700'
                                            }`}>
                                            {ref.isComment ? 'Comment' : 'Post'}
                                        </span>
                                    </p>
                                    <button
                                        className="text-indigo-500 hover:text-indigo-700 font-semibold text-sm"
                                        onClick={() => handleReferenceClick(ref.postId)}>
                                        View Reference
                                    </button>
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-500 italic">
                                No references found for this code.
                            </p>
                        )}
                    </div>
                </>
            ) : selectedPost && selectedPostData ? (
                <>
                    <h1 className="text-2xl font-bold mb-4">{selectedPostData.title}</h1>
                    <p className="mb-6">{selectedPostData.selftext}</p>
                    <h2 className="text-xl font-semibold mb-4">Comments</h2>
                    {(selectedPostData.comments ?? []).map((comment) => (
                        <Comment key={comment.id} comment={comment} />
                    ))}
                </>
            ) : (
                <p className="text-gray-500">Select a document or code to view its details.</p>
            )}
        </div>
    );
};

export default ContentArea;

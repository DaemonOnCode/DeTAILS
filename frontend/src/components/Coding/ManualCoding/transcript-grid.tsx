import { useState, useEffect } from 'react';
import { REMOTE_SERVER_ROUTES } from '../../../constants/Shared';
import { useCollectionContext } from '../../../context/collection-context';
import PostCards from '../CodingTranscript/post-cards';
import { FetchResponse, useApi } from '../../../hooks/Shared/use-api';
import { useWorkspaceContext } from '../../../context/workspace-context';

const fetchPostData = async (
    postIds: string[],
    datasetId: string,
    fetchData: <T = any>(
        route: string,
        options?: RequestInit,
        customAbortController?: AbortController | null
    ) => Promise<FetchResponse<T>>
) => {
    if (!postIds.length || !datasetId) {
        return [];
    }
    const { data, error } = await fetchData<any>(REMOTE_SERVER_ROUTES.GET_POST_ID_TITLE_BATCH, {
        method: 'POST',
        body: JSON.stringify({ post_ids: postIds, dataset_id: datasetId })
    });
    if (error) {
        console.error('Failed to fetch data:', error);
        return [];
    }
    return data;
};

const TranscriptGrid = ({
    postIds,
    postStates,
    onPostSelect
}: {
    postIds: string[];
    postStates: { [postId: string]: boolean };
    onPostSelect: (postId: string) => void;
}) => {
    const { currentWorkspace } = useWorkspaceContext();
    const { fetchData } = useApi();
    const [postData, setPostData] = useState<any[] | null>(null);

    useEffect(() => {
        const loadData = async () => {
            const data = await fetchPostData(postIds, currentWorkspace.id, fetchData);
            setPostData(data);
        };
        loadData();
    }, [postIds, currentWorkspace.id, fetchData]);

    const handleViewTranscript = (postId: string) => {
        console.log('Viewing transcript for post:', postId);
        onPostSelect(postId);
    };

    console.count('Transcripts Page Render');
    return (
        <div>
            {postData ? (
                <PostCards
                    postData={postData}
                    postStates={postStates}
                    onPostClick={(postId) => handleViewTranscript(postId)}
                />
            ) : (
                <p>Loading...</p>
            )}
        </div>
    );
};

export default TranscriptGrid;

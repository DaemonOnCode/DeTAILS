import { Suspense } from 'react';
import { REMOTE_SERVER_ROUTES } from '../../../constants/Shared';
import { useCollectionContext } from '../../../context/collection-context';
import useServerUtils from '../../../hooks/Shared/get-server-url';
import { createResource } from '../../../utility/resource-creator';
import PostCards from '../CodingTranscript/post-cards';
import { FetchResponse, useApi } from '../../../hooks/Shared/use-api';

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
    onPostSelect
}: {
    postIds: string[];
    onPostSelect: (postId: string) => void;
}) => {
    const { datasetId } = useCollectionContext();
    const { fetchData } = useApi();

    const handleViewTranscript = (postId: string) => {
        console.log('Viewing transcript for post:', postId);
        onPostSelect(postId);
    };

    const resource = createResource(fetchPostData(postIds, datasetId, fetchData));

    console.count('Transcripts Page Render');
    return (
        <div>
            <Suspense fallback={<p>Loading...</p>}>
                <PostCards
                    resource={resource}
                    onPostClick={(postId) => handleViewTranscript(postId)}
                />
            </Suspense>
        </div>
    );
};

export default TranscriptGrid;

import { Suspense } from 'react';
import PostCards from '../../components/Coding/CodingTranscript/post-cards';
import useServerUtils from '../../hooks/Shared/get-server-url';
import { useLocation, useNavigate } from 'react-router-dom';
import { REMOTE_SERVER_ROUTES } from '../../constants/Shared';
import { useCollectionContext } from '../../context/collection-context';
import { createResource } from '../../utility/resource-creator';
import { FetchResponse, useApi } from '../../hooks/Shared/use-api';

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

const TranscriptsPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { datasetId, dataset } = useCollectionContext();
    const { fetchData } = useApi();

    // If location.state exists and has postIds, use them; otherwise derive from dataset.
    const postIds: string[] =
        location.state && location.state.postIds
            ? location.state.postIds
            : Array.isArray(dataset)
              ? dataset.map((post: any) => post.id)
              : [];

    const handleViewTranscript = (postId: string) => {
        let params = new URLSearchParams();
        const values = location.state;
        if (values?.split) {
            if (values.selectedTypeFilter !== 'All') {
                params.append('type', values.selectedTypeFilter);
            } else {
                params.append('split', 'true');
            }
        }
        if (values?.showCodebook) {
            params.append('codebook', 'true');
        }
        navigate(
            `/coding/transcript/${postId}/${values?.review ? 'review' : 'refine'}?${params.toString()}`
        );
    };

    // Create a resource that will be used by Suspense to fetch post data.
    const resource = createResource(fetchPostData(postIds, datasetId, fetchData));

    console.count('Transcripts Page Render');

    return (
        <div>
            <Suspense fallback={<p>Loading...</p>}>
                <PostCards
                    resource={resource}
                    onPostClick={(postId: string) => handleViewTranscript(postId)}
                />
            </Suspense>
        </div>
    );
};

export default TranscriptsPage;

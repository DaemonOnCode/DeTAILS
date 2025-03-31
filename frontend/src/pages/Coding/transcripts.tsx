import { useState, useEffect } from 'react';
import PostCards from '../../components/Coding/CodingTranscript/post-cards';
import { useLocation, useNavigate } from 'react-router-dom';
import { REMOTE_SERVER_ROUTES } from '../../constants/Shared';
import { useCollectionContext } from '../../context/collection-context';
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
    const [postData, setPostData] = useState(null);

    // Determine postIds from location.state or dataset
    const postIds: string[] =
        location.state && location.state.postIds
            ? location.state.postIds
            : Array.isArray(dataset)
              ? dataset.map((post: any) => post.id)
              : [];

    // Fetch data when component mounts or dependencies change
    useEffect(() => {
        const loadData = async () => {
            const data = await fetchPostData(postIds, datasetId, fetchData);
            setPostData(data);
        };
        loadData();
    }, [postIds, datasetId, fetchData]);

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

    console.count('Transcripts Page Render');

    return (
        <div>
            {postData !== null ? (
                <PostCards
                    postData={postData}
                    onPostClick={(postId: string) => handleViewTranscript(postId)}
                />
            ) : (
                <p>Loading...</p>
            )}
        </div>
    );
};

export default TranscriptsPage;

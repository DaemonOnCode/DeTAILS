import { Suspense } from 'react';
import PostCards from '../../components/Coding/CodingOverview/post-cards';
import useServerUtils from '../../hooks/Shared/get-server-url';
import { useLocation, useNavigate } from 'react-router-dom';
import { REMOTE_SERVER_ROUTES } from '../../constants/Shared';
import { useCollectionContext } from '../../context/collection-context';
import { createResource } from '../../utility/resource-creator';

const fetchPostData = async (
    postIds: string[],
    datasetId: string,
    getServerUrl: (route: string) => string
) => {
    if (!postIds.length || !datasetId) {
        return [];
    }
    // await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate delay
    const res = await fetch(getServerUrl(REMOTE_SERVER_ROUTES.GET_POST_ID_TITLE_BATCH), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ post_ids: postIds, dataset_id: datasetId })
    });

    if (!res.ok) {
        throw new Error('Failed to fetch data');
    }

    return res.json();
};

const TranscriptsPage = () => {
    const location = useLocation();
    const navigate = useNavigate();

    console.log('Location:', location);

    console.log(location.state, 'location.state');

    // const { sampledPostIds, unseenPostIds } = useCodingContext();
    const { datasetId, selectedPosts } = useCollectionContext();
    const { getServerUrl } = useServerUtils();

    const postIds = location.state === null ? selectedPosts : location.state.postIds;

    const handleViewTranscript = (postId: string) => {
        console.log('Viewing transcript for post:', postId);
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

    const resource = createResource(fetchPostData(postIds, datasetId, getServerUrl));

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

export default TranscriptsPage;

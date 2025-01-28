import { Suspense, lazy, useEffect, useState } from 'react';
import PostCards from '../../components/Coding/CodingOverview/post-cards';
import { useCodingContext } from '../../context/coding_context';
import useServerUtils from '../../hooks/Shared/get_server_url';
import { useLocation } from 'react-router-dom';
import { REMOTE_SERVER_ROUTES } from '../../constants/Shared';
import { useCollectionContext } from '../../context/collection_context';
import { createResource } from '../../utility/resource-creator';

// const PostCards = lazy(() => import('../../components/Coding/CodingOverview/post-cards')); // Lazy import

const fetchPostData = async (
    postIds: string[],
    datasetId: string,
    getServerUrl: (route: string) => string
) => {
    await new Promise((resolve) => setTimeout(resolve, 5000)); // Simulate delay
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

    console.log('Location:', location);

    const { sampledPostIds } = useCodingContext();
    const { datasetId } = useCollectionContext();
    const { getServerUrl } = useServerUtils();

    const handleViewTranscript = (postId: string) => {
        console.log('Viewing transcript for post:', postId);
    };

    const resource = createResource(fetchPostData(sampledPostIds, datasetId, getServerUrl));

    console.count('Transcripts Page Render');
    return (
        <div>
            <Suspense fallback={<p>Loading...</p>}>
                <PostCards resource={resource} onPostClick={() => {}} />
            </Suspense>
        </div>
    );
};

export default TranscriptsPage;

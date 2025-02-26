import { Suspense } from 'react';
import { REMOTE_SERVER_ROUTES } from '../../../constants/Shared';
import { useCollectionContext } from '../../../context/collection-context';
import useServerUtils from '../../../hooks/Shared/get-server-url';
import { createResource } from '../../../utility/resource-creator';
import PostCards from '../CodingTranscript/post-cards';

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

const TranscriptGrid = ({
    postIds,
    onPostSelect
}: {
    postIds: string[];
    onPostSelect: (postId: string) => void;
}) => {
    const { datasetId } = useCollectionContext();
    const { getServerUrl } = useServerUtils();

    const handleViewTranscript = (postId: string) => {
        console.log('Viewing transcript for post:', postId);
        onPostSelect(postId);
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

export default TranscriptGrid;

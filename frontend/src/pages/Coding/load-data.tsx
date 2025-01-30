import { useEffect, useRef } from 'react';
import NavigationBottomBar from '../../components/Coding/Shared/navigation_bottom_bar';
import RedditTableRenderer from '../../components/Shared/reddit_table_renderer';
import { ROUTES, SELECTED_POSTS_MIN_THRESHOLD } from '../../constants/Coding/shared';
import { REMOTE_SERVER_ROUTES } from '../../constants/Shared';
import { useCodingContext } from '../../context/coding_context';
import { useCollectionContext } from '../../context/collection_context';
import { useLogger } from '../../context/logging_context';
import useRedditData from '../../hooks/Home/use_reddit_data';
import useServerUtils from '../../hooks/Shared/get_server_url';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import { createTimer } from '../../utility/timer';

const LoadData = () => {
    const { selectedPosts, datasetId } = useCollectionContext();
    const { data, loadFolderData, loading } = useRedditData();
    const { setSampledPostIds, setUnseenPostIds } = useCodingContext();

    const logger = useLogger();

    console.log('rendered home page');
    console.count('Component Render');

    const { saveWorkspaceData } = useWorkspaceUtils();
    const { getServerUrl } = useServerUtils();

    useEffect(() => {
        console.log('loading:', loading);
    }, [loading]);

    const hasSavedRef = useRef(false);
    useEffect(() => {
        const timer = createTimer();
        logger.info('Home Page Loaded');

        loadFolderData();

        return () => {
            if (!hasSavedRef.current) {
                saveWorkspaceData();
                hasSavedRef.current = true;
            }
            logger.info('Home Page Unloaded').then(() => {
                logger.time('Home Page stay time', { time: timer.end() });
            });
        };
    }, []);

    // Pagination Logic
    const isReadyCheck =
        Object.keys(data).length > 0 && selectedPosts.length >= SELECTED_POSTS_MIN_THRESHOLD;

    const handleSamplingPosts = async () => {
        console.log('Sampling posts:', selectedPosts);
        let res = await fetch(getServerUrl(REMOTE_SERVER_ROUTES.SAMPLE_POSTS), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ dataset_id: datasetId, post_ids: selectedPosts ?? [] })
        });

        let results = await res.json();
        console.log('Results:', results);

        setSampledPostIds(results['sampled']);
        setUnseenPostIds(results['unseen']);

        console.log('Generate initial codes:', results['sampled']);
        res = await fetch(getServerUrl(REMOTE_SERVER_ROUTES.GENERATE_INITIAL_CODES), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                dataset_id: datasetId,
                post_ids: results['sampled'] ?? []
            })
        });

        results = await res.json();
        console.log('Results:', results);
    };
    return (
        <div className="w-full h-full flex flex-col">
            <RedditTableRenderer
                data={data}
                maxTableHeightClass="max-h-[calc(100vh-22rem)]"
                loading={loading}
            />
            <NavigationBottomBar
                previousPage={ROUTES.KEYWORD_TABLE}
                nextPage={ROUTES.CODES_REVIEW}
                isReady={isReadyCheck}
                onNextClick={handleSamplingPosts}
            />
        </div>
    );
};

export default LoadData;

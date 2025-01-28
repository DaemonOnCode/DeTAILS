import { FC, useContext, useEffect, useRef } from 'react';
import NavigationBottomBar from '../../components/Coding/Shared/navigation_bottom_bar';
import { ROUTES, SELECTED_POSTS_MIN_THRESHOLD } from '../../constants/Coding/shared';
import { useLogger } from '../../context/logging_context';
import { createTimer } from '../../utility/timer';
import useRedditData from '../../hooks/Home/use_reddit_data';
import RedditTableRenderer from '../../components/Shared/reddit_table_renderer';
import { useCollectionContext } from '../../context/collection_context';
import { REMOTE_SERVER_ROUTES, USE_NEW_FLOW } from '../../constants/Shared';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import { get } from 'http';
import useServerUtils from '../../hooks/Shared/get_server_url';
import { useCodingContext } from '../../context/coding_context';

const HomePage: FC = () => {
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
        const res = await fetch(getServerUrl(REMOTE_SERVER_ROUTES.SAMPLE_POSTS), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ dataset_id: datasetId, post_ids: selectedPosts ?? [] })
        });

        const results = await res.json();
        console.log('Results:', results);

        setSampledPostIds(results['sampled']);
        setUnseenPostIds(results['unseen']);
    };

    return (
        <div className="w-full h-full flex flex-col">
            <RedditTableRenderer
                data={data}
                maxTableHeightClass="max-h-[calc(100vh-22rem)]"
                loading={loading}
            />
            <NavigationBottomBar
                nextPage={ROUTES.CONTEXT_V2}
                isReady={isReadyCheck}
                onNextClick={handleSamplingPosts}
            />
        </div>
    );
};

export default HomePage;

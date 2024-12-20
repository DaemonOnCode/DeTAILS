import { FC, useContext, useEffect } from 'react';
import NavigationBottomBar from '../../components/Coding/Shared/navigation_bottom_bar';
import { ROUTES, SELECTED_POSTS_MIN_THRESHOLD } from '../../constants/Coding/shared';
import { useLogger } from '../../context/logging_context';
import { createTimer } from '../../utility/timer';
import useRedditData from '../../hooks/Home/use_reddit_data';
import RedditTableRenderer from '../../components/Shared/reddit_table_renderer';
import { useCollectionContext } from '../../context/collection_context';
import { USE_NEW_FLOW } from '../../constants/Shared';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';

const HomePage: FC = () => {
    const { selectedPosts } = useCollectionContext();
    const { data, loadFolderData, loading } = useRedditData();

    const logger = useLogger();

    console.log('rendered home page');
    console.count('Component Render');

    const { saveWorkspaceData } = useWorkspaceUtils();

    useEffect(() => {
        console.log('loading:', loading);
    }, [loading]);

    useEffect(() => {
        const timer = createTimer();
        logger.info('Home Page Loaded');

        loadFolderData();

        return () => {
            saveWorkspaceData();
            logger.info('Home Page Unloaded').then(() => {
                logger.time('Home Page stay time', { time: timer.end() });
            });
        };
    }, []);

    // Pagination Logic
    const isReadyCheck =
        Object.keys(data).length > 0 && selectedPosts.length >= SELECTED_POSTS_MIN_THRESHOLD;

    return (
        <div className="w-full h-full flex flex-col">
            <RedditTableRenderer
                data={data}
                maxTableHeightClass="max-h-[calc(100vh-22rem)]"
                loading={loading}
            />
            <NavigationBottomBar
                nextPage={USE_NEW_FLOW ? ROUTES.BASIS_V2 : ROUTES.BASIS}
                isReady={isReadyCheck}
            />
        </div>
    );
};

export default HomePage;

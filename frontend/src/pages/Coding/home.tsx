import { FC, useContext, useEffect } from 'react';
import NavigationBottomBar from '../../components/Coding/Shared/navigation_bottom_bar';
import { DataContext } from '../../context/data_context';
import { ROUTES, SELECTED_POSTS_MIN_THRESHOLD } from '../../constants/Coding/shared';
import { useLogger } from '../../context/logging_context';
import { createTimer } from '../../utility/timer';
import useRedditData from '../../hooks/Home/use_reddit_data';
import RedditTableRenderer from '../../components/Shared/reddit_table_renderer';

const HomePage: FC = () => {
    const dataContext = useContext(DataContext);
    const { data, loadFolderData } = useRedditData();

    const logger = useLogger();

    console.log('rendered home page');
    console.count('Component Render');

    useEffect(() => {
        const timer = createTimer();
        logger.info('Home Page Loaded');

        loadFolderData();

        return () => {
            logger.info('Home Page Unloaded').then(() => {
                logger.time('Home Page stay time', { time: timer.end() });
            });
        };
    }, []);

    // Pagination Logic
    const isReadyCheck =
        Object.keys(data).length > 0 &&
        dataContext.selectedPosts.length >= SELECTED_POSTS_MIN_THRESHOLD;

    return (
        <div className="w-full h-full flex flex-col">
            <RedditTableRenderer data={data} maxTableHeightClass="max-h-[calc(100vh-18rem)]" />
            <NavigationBottomBar nextPage={ROUTES.BASIS} isReady={isReadyCheck} />
        </div>
    );
};

export default HomePage;

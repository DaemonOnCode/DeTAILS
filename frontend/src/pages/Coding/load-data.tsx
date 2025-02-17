import { useEffect, useRef } from 'react';
import NavigationBottomBar from '../../components/Coding/Shared/navigation-bottom-bar';
import RedditTableRenderer from '../../components/Shared/reddit-table-renderer';
import { LOADER_ROUTES, ROUTES, SELECTED_POSTS_MIN_THRESHOLD } from '../../constants/Coding/shared';
import { MODEL_LIST, REMOTE_SERVER_ROUTES } from '../../constants/Shared';
import { useCodingContext } from '../../context/coding-context';
import { useCollectionContext } from '../../context/collection-context';
import { useLogger } from '../../context/logging-context';
import useRedditData from '../../hooks/DataCollection/use-reddit-data';
import useServerUtils from '../../hooks/Shared/get-server-url';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import { createTimer } from '../../utility/timer';
import { useNavigate } from 'react-router-dom';

const LoadData = () => {
    const { selectedPosts, datasetId } = useCollectionContext();
    const { data, loadFolderData, loading } = useRedditData();
    const {
        setSampledPostIds,
        setUnseenPostIds,
        keywordTable,
        mainTopic,
        additionalInfo,
        researchQuestions,
        dispatchSampledPostResponse
    } = useCodingContext();

    const navigate = useNavigate();

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

        loadFolderData(true, true);

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

    const isReadyCheck =
        Object.keys(data).length > 0 && selectedPosts.length >= SELECTED_POSTS_MIN_THRESHOLD;

    const handleSamplingPosts = async () => {
        if (!datasetId) return;
        navigate('../loader/' + LOADER_ROUTES.CODEBOOK_LOADER);
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

        console.log(
            'Generate initial codes:',
            results['sampled'],
            keywordTable.filter((keyword) => keyword.isMarked !== undefined)
            // .map((keyword) => {
            //     delete keyword.isMarked;
            //     return keyword;
            // })
        );
        res = await fetch(getServerUrl(REMOTE_SERVER_ROUTES.GENERATE_INITIAL_CODES), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                dataset_id: datasetId,
                keyword_table: keywordTable.filter((keyword) => keyword.isMarked !== undefined),
                // .map((keyword) => {
                //     delete keyword.isMarked;
                //     return keyword;
                // }),
                model: MODEL_LIST.GEMINI_FLASH,
                main_topic: mainTopic,
                additional_info: additionalInfo,
                research_questions: researchQuestions,
                sampled_post_ids: results['sampled'] ?? []
            })
        });

        results = await res.json();
        console.log('Results:', results);

        dispatchSampledPostResponse({
            type: 'SET_RESPONSES',
            responses: results['data']
        });
    };
    return (
        <div className="h-page flex flex-col">
            {/* Main scrollable content */}
            <main className="flex-1 overflow-auto">
                <RedditTableRenderer
                    data={data}
                    maxContainerHeight="min-h-maxPageContent"
                    maxTableHeightClass="max-h-[calc(100vh-18rem)]"
                    loading={loading}
                />
            </main>
            {/* Fixed bottom navigation */}
            <footer>
                <NavigationBottomBar
                    previousPage={`${ROUTES.BACKGROUND_RESEARCH}/${ROUTES.KEYWORD_TABLE}`}
                    nextPage={ROUTES.CODEBOOK_CREATION}
                    isReady={isReadyCheck}
                    onNextClick={handleSamplingPosts}
                />
            </footer>
        </div>
    );
};

export default LoadData;

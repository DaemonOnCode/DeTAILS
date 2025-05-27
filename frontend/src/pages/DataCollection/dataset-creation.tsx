import { useEffect, useRef } from 'react';
import { useCollectionContext } from '../../context/collection-context';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import NavigationBottomBar from '../../components/Coding/Shared/navigation-bottom-bar';
import {
    LOADER_ROUTES,
    PAGE_ROUTES,
    ROUTES,
    SELECTED_POSTS_MIN_THRESHOLD
} from '../../constants/Coding/shared';
import { REMOTE_SERVER_ROUTES } from '../../constants/Shared';
import { useCodingContext } from '../../context/coding-context';
import { ROUTES as SHARED_ROUTES } from '../../constants/Shared';
import { useLogger } from '../../context/logging-context';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import { getCodingLoaderUrl } from '../../utility/get-loader-url';
import { TutorialStep } from '../../components/Shared/custom-tutorial-overlay';
import TutorialWrapper from '../../components/Shared/tutorial-wrapper';
import RedditTableRenderer from '../../components/Shared/reddit-table-renderer';
import useRedditData from '../../hooks/DataCollection/use-reddit-data';
import { useLoadingContext } from '../../context/loading-context';
import { useSettings } from '../../context/settings-context';
import { useWorkspaceContext } from '../../context/workspace-context';
import { useNextHandler } from '../../hooks/Coding/use-handler-factory';

const DatasetCreationPage = () => {
    const { type, selectedData, setSelectedData, modeInput, isLocked } = useCollectionContext();
    const navigate = useNavigate();
    const { setSampledPostIds, setUnseenPostIds } = useCodingContext();
    const { settings } = useSettings();
    const { loadFolderData, loadTorrentData } = useRedditData();
    const { saveWorkspaceData } = useWorkspaceUtils();
    const hasSavedRef = useRef(false);
    const location = useLocation();
    const { currentWorkspace } = useWorkspaceContext();
    const { loadingState } = useLoadingContext();

    const postIds: string[] = selectedData;
    const isReadyCheck = postIds.length >= SELECTED_POSTS_MIN_THRESHOLD && isLocked;

    useEffect(() => {
        if (loadingState[stepRoute]?.isLoading) {
            const inputSplits = modeInput.split('|');
            if (inputSplits.length && inputSplits[0] === 'reddit') {
                if (inputSplits[1] === 'torrent') {
                    if (inputSplits[3] === 'files') {
                        navigate(getCodingLoaderUrl(LOADER_ROUTES.REDDIT_DATA_LOADER));
                    } else {
                        navigate(getCodingLoaderUrl(LOADER_ROUTES.TORRENT_DATA_LOADER));
                    }
                } else {
                    navigate(getCodingLoaderUrl(LOADER_ROUTES.REDDIT_DATA_LOADER));
                }
            }
        } else {
            const inputSplits = modeInput.split('|');
            if (inputSplits.length && inputSplits[0] === 'reddit') {
                if (inputSplits[1] === 'torrent') {
                    loadTorrentData();
                } else {
                    loadFolderData();
                }
            }
        }

        return () => {
            if (!hasSavedRef.current) {
                hasSavedRef.current = true;
                saveWorkspaceData().finally(() => {
                    hasSavedRef.current = false;
                });
            }
        };
    }, []);

    const stepRoute = location.pathname;

    const steps: TutorialStep[] = [
        {
            target: '#viewer-main',
            content:
                'Welcome to the View Dataset Page. Here you can select your loaded data. The data you select here will be used for coding.',
            placement: 'top'
        },
        {
            target: '#reddit-table-search',
            content: 'Use this to search for specific entries (Only supports exact text matching).',
            placement: 'bottom'
        },
        {
            target: '#reddit-table-filter-button',
            content: 'You can use this to filter out the necessary data.',
            placement: 'bottom'
        },
        {
            target: '#reddit-post-checkbox-0',
            content: 'Use this to select and unselect a post.',
            placement: 'right'
        },
        {
            target: '#proceed-next-step',
            content: 'Proceed to next step',
            placement: 'left'
        }
    ];

    const handleSampling = useNextHandler({
        startLog: 'Sampling posts',
        doneLog: 'Sampling completed',
        loadingRoute: PAGE_ROUTES.INITIAL_CODING,
        loaderRoute: LOADER_ROUTES.FINAL_CODING_LOADER,
        loaderParams: { text: 'Initial Coding in Progress' },
        remoteRoute: REMOTE_SERVER_ROUTES.SAMPLE_POSTS,
        useLLM: false,
        buildBody: () =>
            JSON.stringify({
                workspace_id: currentWorkspace!.id,
                post_ids: postIds,
                divisions: 2,
                sample_size: settings.general.sampleRatio
            }),
        onSuccess: (data: { message: string; sampled: string[]; unseen: string[] }) => {
            setSampledPostIds(data.sampled);
            setUnseenPostIds(data.unseen);
        },
        unsetLoadingDone: true
    });
    const handleGenerateInitialCodes = useNextHandler({
        startLog: 'Generating initial codes',
        doneLog: 'Initial codes generated',
        loadingRoute: PAGE_ROUTES.INITIAL_CODING,
        loaderRoute: LOADER_ROUTES.FINAL_CODING_LOADER,
        loaderParams: { text: 'Initial Coding in Progress' },
        remoteRoute: REMOTE_SERVER_ROUTES.GENERATE_INITIAL_CODES,
        useLLM: true,
        buildBody: () => JSON.stringify({ model: settings.ai.model }),
        onSuccess: (data) => console.log('Results:', data)
    });

    if (loadingState[stepRoute]?.isFirstRun) {
        return (
            <p className="h-page w-full flex justify-center items-center">
                Please complete the previous page and click on proceed to continue with this page.
            </p>
        );
    }

    const isDataLoaded = Boolean(modeInput);

    if (!type || !modeInput) {
        return (
            <div className="flex flex-col items-center justify-center h-page">
                <p className="mb-4">Choose data source to create dataset.</p>
                <Link
                    to={`/${SHARED_ROUTES.CODING}/${ROUTES.LOAD_DATA}/${ROUTES.DATA_SOURCE}`}
                    className="text-blue-500">
                    Go back to Data source
                </Link>
            </div>
        );
    }

    return (
        <>
            <TutorialWrapper
                steps={steps}
                pageId={location.pathname}
                excludedTarget={`#route-/${SHARED_ROUTES.CODING}/${ROUTES.LOAD_DATA}`}>
                <div className="h-page flex flex-col">
                    <main id="viewer-main" className="flex-1 overflow-hidden">
                        {isDataLoaded && (
                            <RedditTableRenderer
                                selectedData={selectedData}
                                setSelectedData={setSelectedData}
                            />
                        )}
                    </main>
                    <footer id="bottom-navigation">
                        <NavigationBottomBar
                            disabledTooltipText="Please select at least 5 posts to proceed and lock the dataset to proceed."
                            previousPage={PAGE_ROUTES.DATA_SOURCE}
                            nextPage={PAGE_ROUTES.INITIAL_CODING}
                            isReady={isReadyCheck}
                            onNextClick={async () => {
                                let error = false;
                                error = await handleSampling();
                                console.log('Error in Sampling:', error);
                                error = await handleGenerateInitialCodes();
                                console.log('Error in Generating:', error);
                                return error;
                            }}
                        />
                    </footer>
                </div>
            </TutorialWrapper>
        </>
    );
};

export default DatasetCreationPage;

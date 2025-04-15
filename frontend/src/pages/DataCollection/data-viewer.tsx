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
import { useApi } from '../../hooks/Shared/use-api';
import { useSettings } from '../../context/settings-context';
import { toast } from 'react-toastify';
import { useWorkspaceContext } from '../../context/workspace-context';
import { useManualCodingContext } from '../../context/manual-coding-context';

const DataViewerPage = () => {
    const { type, datasetId, selectedData, setSelectedData, modeInput, isLocked } =
        useCollectionContext();
    const navigate = useNavigate();
    const { setSampledPostIds, setUnseenPostIds, keywordTable } = useCodingContext();
    const { settings } = useSettings();
    const { loadFolderData, loadTorrentData } = useRedditData();
    const logger = useLogger();
    const { saveWorkspaceData } = useWorkspaceUtils();
    const { fetchData, fetchLLMData } = useApi();
    const hasSavedRef = useRef(false);
    const location = useLocation();
    const { currentWorkspace } = useWorkspaceContext();
    const { loadingState, loadingDispatch } = useLoadingContext();

    const postIds: string[] = selectedData;
    const isReadyCheck = postIds.length >= SELECTED_POSTS_MIN_THRESHOLD && isLocked;
    const { addPostIds } = useManualCodingContext();

    useEffect(() => {
        if (loadingState[stepRoute]?.isLoading) {
            const inputSplits = modeInput.split('|');
            if (inputSplits.length && inputSplits[0] === 'reddit') {
                if (inputSplits[1] === 'torrent') {
                    if (inputSplits[3] === 'files') {
                        navigate(
                            getCodingLoaderUrl(LOADER_ROUTES.DATA_LOADING_LOADER, {
                                text: 'Loading Data'
                            })
                        );
                    } else {
                        navigate(getCodingLoaderUrl(LOADER_ROUTES.TORRENT_DATA_LOADER));
                    }
                } else {
                    navigate(
                        getCodingLoaderUrl(LOADER_ROUTES.DATA_LOADING_LOADER, {
                            text: 'Loading Data'
                        })
                    );
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
                'Welcome to the View Dataset Page. Here you can select your loaded data. The data you select here will be used for deductive coding.',
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

    const handleSamplingPosts = async () => {
        if (!datasetId) return;
        loadingDispatch({
            type: 'SET_LOADING_ROUTE',
            route: PAGE_ROUTES.CODEBOOK_CREATION
        });
        navigate(
            getCodingLoaderUrl(LOADER_ROUTES.DEDUCTIVE_CODING_LOADER, {
                text: 'Initial Coding in Progress'
            })
        );
        console.log('Sampling posts:', postIds);

        await new Promise((resolve) => setTimeout(resolve, 5000));
        const { data: sampleData, error: sampleError } = await fetchData<
            | {
                  message: string;
                  sampled: string[];
                  unseen: string[];
              }
            | {
                  message: string;
                  sampled: string[];
                  unseen: string[];
                  test: string[];
              }
        >(REMOTE_SERVER_ROUTES.SAMPLE_POSTS, {
            method: 'POST',
            body: JSON.stringify({
                workspace_id: currentWorkspace!.id,
                dataset_id: datasetId,
                post_ids: postIds,
                divisions: settings.general.manualCoding ? 3 : 2,
                ...(!settings.general.manualCoding
                    ? { sample_size: settings.general.sampleRatio }
                    : {})
            })
        });

        if (sampleError) {
            console.error('Error sampling posts:', sampleError);
            if (sampleError.name !== 'AbortError') {
                loadingDispatch({
                    type: 'SET_LOADING_DONE_ROUTE',
                    route: PAGE_ROUTES.CODEBOOK_CREATION
                });
                throw new Error(sampleError.message.error_message);
            }
            return;
        }

        console.log('Results:', sampleData);

        setSampledPostIds(sampleData['sampled']);
        setUnseenPostIds(sampleData['unseen']);

        if (settings.general.manualCoding) {
            // @ts-ignore
            addPostIds(sampleData['test']);
        }

        console.log(
            'Generate initial codes:',
            sampleData['sampled'],
            keywordTable.filter((keyword) => keyword.isMarked !== undefined)
        );
        const { data: codeData, error: codeError } = await fetchLLMData<{
            message: string;
            data: any[];
        }>(REMOTE_SERVER_ROUTES.GENERATE_INITIAL_CODES, {
            method: 'POST',
            body: JSON.stringify({
                model: settings.ai.model
            })
        });

        if (codeError) {
            console.error('Error generating initial codes:', codeError);
            if (codeError.name !== 'AbortError') {
                toast.error('Error generating initial codes. ' + (codeError.message ?? ''));
                navigate(`/${SHARED_ROUTES.CODING}/${ROUTES.LOAD_DATA}/${ROUTES.DATASET_CREATION}`);
                loadingDispatch({
                    type: 'SET_LOADING_DONE_ROUTE',
                    route: PAGE_ROUTES.CODEBOOK_CREATION
                });
                console.error(
                    'Error generating initial codes:',
                    codeError,
                    'navigate to dataset creation'
                );
                throw new Error(codeError.message);
            }
            return;
        }

        console.log('Results:', codeData);

        loadingDispatch({
            type: 'SET_LOADING_DONE_ROUTE',
            route: PAGE_ROUTES.CODEBOOK_CREATION
        });
    };

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
                            nextPage={PAGE_ROUTES.CODEBOOK_CREATION}
                            isReady={isReadyCheck}
                            onNextClick={handleSamplingPosts}
                        />
                    </footer>
                </div>
            </TutorialWrapper>
        </>
    );
};

export default DataViewerPage;

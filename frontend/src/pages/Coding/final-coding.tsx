import { useEffect, useRef } from 'react';
import NavigationBottomBar from '../../components/Coding/Shared/navigation-bottom-bar';
import UnifiedCodingPage from '../../components/Coding/UnifiedCoding/unified-coding-section';
import { LOADER_ROUTES, PAGE_ROUTES } from '../../constants/Coding/shared';
import { useCodingContext } from '../../context/coding-context';
import { useLogger } from '../../context/logging-context';
import { createTimer } from '../../utility/timer';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { REMOTE_SERVER_ROUTES } from '../../constants/Shared';
import { getCodingLoaderUrl } from '../../utility/get-loader-url';
import { TutorialStep } from '../../components/Shared/custom-tutorial-overlay';
import TutorialWrapper from '../../components/Shared/tutorial-wrapper';
import { useLoadingContext } from '../../context/loading-context';
import { toast } from 'react-toastify';
import { useApi } from '../../hooks/Shared/use-api';
import { useSettings } from '../../context/settings-context';

const FinalCodingPage = () => {
    const [searchParams] = useSearchParams();
    const reviewParam = searchParams.get('review') !== 'false';

    const { dispatchUnseenPostResponse, unseenPostIds } = useCodingContext();
    const { settings } = useSettings();
    const location = useLocation();
    const logger = useLogger();
    const navigate = useNavigate();
    const { saveWorkspaceData } = useWorkspaceUtils();
    const { fetchLLMData } = useApi();

    const { loadingState, loadingDispatch, openModal, resetDataAfterPage, checkIfDataExists } =
        useLoadingContext();
    const hasSavedRef = useRef(false);
    useEffect(() => {
        const timer = createTimer();
        logger.info('Final coding Page Loaded');

        return () => {
            if (!hasSavedRef.current) {
                hasSavedRef.current = true;
                saveWorkspaceData().finally(() => {
                    hasSavedRef.current = false;
                });
            }
            logger.info('Final coding Page Unloaded').then(() => {
                logger.time('Final coding Page stay time', { time: timer.end() });
            });
        };
    }, []);

    const stepRoute = location.pathname;

    const handleRedoCoding = async () => {
        navigate(
            getCodingLoaderUrl(LOADER_ROUTES.FINAL_CODING_LOADER, {
                text: 'Final Coding in Progress'
            })
        );

        loadingDispatch({
            type: 'SET_LOADING_ROUTE',
            route: PAGE_ROUTES.FINAL_CODING
        });

        const { data: results, error } = await fetchLLMData<{
            message: string;
        }>(REMOTE_SERVER_ROUTES.FINAL_CODING, {
            method: 'POST',
            body: JSON.stringify({
                model: settings.ai.model
            })
        });

        if (error) {
            console.error('Error in handleRedoCoding:', error);
            if (error.name) {
                loadingDispatch({
                    type: 'SET_LOADING_DONE_ROUTE',
                    route: PAGE_ROUTES.FINAL_CODING
                });
            }
            return;
        }

        console.log('Results:', results);

        loadingDispatch({
            type: 'SET_LOADING_DONE_ROUTE',
            route: PAGE_ROUTES.FINAL_CODING
        });
        navigate(PAGE_ROUTES.FINAL_CODING);
    };

    const handleNextClick = async () => {
        loadingDispatch({
            type: 'SET_LOADING_ROUTE',
            route: PAGE_ROUTES.REVIEWING_CODES
        });
        navigate(
            getCodingLoaderUrl(LOADER_ROUTES.DATA_LOADING_LOADER, {
                text: 'Reviewing codes'
            })
        );

        const { data: results, error } = await fetchLLMData<{
            message: string;
        }>(REMOTE_SERVER_ROUTES.GROUP_CODES, {
            method: 'POST',
            body: JSON.stringify({
                model: settings.ai.model
            })
        });

        if (error) {
            console.error('Error refreshing themes:', error);
            if (error.name !== 'AbortError') {
                toast.error('Error finalizing codes ' + (error.message ?? ''));
                navigate(PAGE_ROUTES.FINAL_CODING);
                loadingDispatch({
                    type: 'SET_LOADING_DONE_ROUTE',
                    route: PAGE_ROUTES.REVIEWING_CODES
                });
                throw new Error(error.message);
            }
            return;
        }

        console.log('Results:', results);

        loadingDispatch({
            type: 'SET_LOADING_DONE_ROUTE',
            route: PAGE_ROUTES.REVIEWING_CODES
        });
    };

    const steps: TutorialStep[] = [
        {
            target: '#unified-coding-page',
            content:
                'This area shows your unified coding interface with all your posts and coding responses for Final coding.',
            placement: 'bottom'
        },
        {
            target: '#coding-controls',
            content:
                'Use these controls to download the generated final codes or toggle review mode for coding responses.',
            placement: 'bottom'
        },
        {
            target: '#redo-coding-btn',
            content:
                'Use this button to redo final coding based on the previously generated codes and some optional feedback.',
            placement: 'top'
        },
        {
            target: '#proceed-next-step',
            content: 'Step 4: Proceed to next step',
            placement: 'top'
        }
    ];

    useEffect(() => {
        if (loadingState[stepRoute]?.isLoading) {
            navigate(getCodingLoaderUrl(LOADER_ROUTES.FINAL_CODING_LOADER));
        }
    }, []);

    if (loadingState[stepRoute]?.isFirstRun) {
        return (
            <p className="h-page w-full flex justify-center items-center">
                Please complete the previous page and click on proceed to continue with this page.
            </p>
        );
    }

    return (
        <TutorialWrapper
            steps={steps}
            pageId={location.pathname}
            excludedTarget={`#route-${PAGE_ROUTES.FINAL_CODING}`}>
            <div className="h-page flex flex-col">
                <div className="flex-1 overflow-hidden">
                    <UnifiedCodingPage
                        postIds={unseenPostIds}
                        // data={unseenPostResponse}
                        responseTypes={['sampled', 'unseen']}
                        dispatchFunction={dispatchUnseenPostResponse}
                        // showThemes
                        showRerunCoding
                        // split
                        review={reviewParam}
                        showCodebook
                        showFilterDropdown
                        applyFilters
                        coderType="LLM"
                        handleRerun={async () => {
                            if (await checkIfDataExists(location.pathname)) {
                                openModal('final-coding-redo', async () => {
                                    await resetDataAfterPage(location.pathname);
                                    await handleRedoCoding();
                                });
                            } else {
                                loadingDispatch({
                                    type: 'SET_REST_UNDONE',
                                    route: location.pathname
                                });
                                handleRedoCoding();
                            }
                        }}
                    />
                </div>
                <NavigationBottomBar
                    previousPage={PAGE_ROUTES.INITIAL_CODEBOOK}
                    nextPage={PAGE_ROUTES.REVIEWING_CODES}
                    isReady={true}
                    onNextClick={handleNextClick}
                />
            </div>
        </TutorialWrapper>
    );
};

export default FinalCodingPage;

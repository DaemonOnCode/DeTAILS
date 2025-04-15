import { useRef, useEffect } from 'react';
import NavigationBottomBar from '../../components/Coding/Shared/navigation-bottom-bar';
import UnifiedCodingPage from '../../components/Coding/UnifiedCoding/unified-coding-section';
import { LOADER_ROUTES, PAGE_ROUTES, ROUTES } from '../../constants/Coding/shared';
import { useCodingContext } from '../../context/coding-context';
import { useLogger } from '../../context/logging-context';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import { createTimer } from '../../utility/timer';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { REMOTE_SERVER_ROUTES } from '../../constants/Shared';
import { getCodingLoaderUrl } from '../../utility/get-loader-url';
import TutorialWrapper from '../../components/Shared/tutorial-wrapper';
import { TutorialStep } from '../../components/Shared/custom-tutorial-overlay';
import { useLoadingContext } from '../../context/loading-context';
import { ROUTES as SHARED_ROUTES } from '../../constants/Shared';
import { useApi } from '../../hooks/Shared/use-api';
import { useSettings } from '../../context/settings-context';

const CodebookCreation = () => {
    const [searchParams] = useSearchParams();
    const reviewParam = searchParams.get('review') !== 'false';

    const { settings } = useSettings();

    const { sampledPostResponse, dispatchSampledPostResponse, sampledPostIds } = useCodingContext();
    const location = useLocation();

    const logger = useLogger();
    const { saveWorkspaceData } = useWorkspaceUtils();
    const navigate = useNavigate();
    const { fetchLLMData } = useApi();

    const { loadingState, loadingDispatch, checkIfDataExists, resetDataAfterPage, openModal } =
        useLoadingContext();
    const hasSavedRef = useRef(false);
    useEffect(() => {
        const timer = createTimer();
        logger.info('Code Creation Page Loaded');

        return () => {
            if (!hasSavedRef.current) {
                hasSavedRef.current = true;
                saveWorkspaceData().finally(() => {
                    hasSavedRef.current = false;
                });
            }
            logger.info('Code Creation Page Unloaded').then(() => {
                logger.time('Code Creation Page stay time', { time: timer.end() });
            });
        };
    }, []);

    const stepRoute = location.pathname;

    const handleRedoCoding = async () => {
        loadingDispatch({
            type: 'SET_LOADING_ROUTE',
            route: PAGE_ROUTES.CODEBOOK_CREATION
        });
        navigate(
            getCodingLoaderUrl(LOADER_ROUTES.DEDUCTIVE_CODING_LOADER, {
                text: 'Initial Coding in Progress'
            })
        );

        const { data: results, error } = await fetchLLMData(REMOTE_SERVER_ROUTES.REMAKE_CODEBOOK, {
            method: 'POST',
            body: JSON.stringify({
                model: settings.ai.model
            })
        });

        if (error) {
            console.error('Error in handleRedoCoding:', error);
            loadingDispatch({
                type: 'SET_LOADING_DONE_ROUTE',
                route: PAGE_ROUTES.CODEBOOK_CREATION
            });
            return;
        }

        console.log('Results:', results);

        loadingDispatch({
            type: 'SET_LOADING_DONE_ROUTE',
            route: PAGE_ROUTES.CODEBOOK_CREATION
        });
        navigate(PAGE_ROUTES.CODEBOOK_CREATION);
    };

    const handleNextClick = async () => {
        navigate(getCodingLoaderUrl(LOADER_ROUTES.CODEBOOK_LOADER));

        loadingDispatch({
            type: 'SET_LOADING_ROUTE',
            route: PAGE_ROUTES.INITIAL_CODEBOOK
        });

        const { data: results, error } = await fetchLLMData<{
            message: string;
            data: {
                [code: string]: string;
            };
        }>(REMOTE_SERVER_ROUTES.GENERATE_CODEBOOK_WITHOUT_QUOTES, {
            method: 'POST',
            body: JSON.stringify({
                model: settings.ai.model
            })
        });

        if (error) {
            console.error('Error in handleNextClick:', error);
            if (error.name !== 'AbortError') {
                toast.error('Error generating codebook. Please try again.');
                navigate(PAGE_ROUTES.CODEBOOK_CREATION);
                loadingDispatch({
                    type: 'SET_LOADING_DONE_ROUTE',
                    route: PAGE_ROUTES.INITIAL_CODEBOOK
                });
                throw new Error(error.message);
            }
            return;
        }

        console.log('Results:', results);

        loadingDispatch({
            type: 'SET_LOADING_DONE_ROUTE',
            route: PAGE_ROUTES.INITIAL_CODEBOOK
        });
    };

    const steps: TutorialStep[] = [
        {
            target: '#unified-coding-page',
            content:
                'This area shows your unified coding interface with all your posts and coding responses for Codebook.',
            placement: 'bottom'
        },
        {
            target: '#coding-controls',
            content:
                'Use these controls to download the codebook or toggle review mode for coding responses.',
            placement: 'bottom'
        },
        {
            target: '#redo-coding-btn',
            content:
                'Use this button to create a new codebook based on the previous codebook and some optional feedback.',
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
            navigate(
                getCodingLoaderUrl(LOADER_ROUTES.DEDUCTIVE_CODING_LOADER, {
                    text: 'Initial Coding in Progress'
                })
            );
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
            excludedTarget={`#route-/${SHARED_ROUTES.CODING}/${ROUTES.INITIAL_CODING_CODEBOOK}`}>
            <div className="h-page flex flex-col">
                <div className="flex-1 overflow-hidden">
                    <UnifiedCodingPage
                        postIds={sampledPostIds}
                        data={sampledPostResponse}
                        dispatchFunction={dispatchSampledPostResponse}
                        review={reviewParam}
                        showCoderType={false}
                        showCodebook={true}
                        showRerunCoding
                        handleRerun={() => {
                            if (checkIfDataExists(location.pathname)) {
                                openModal('codebook-redo', async () => {
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
                    previousPage={PAGE_ROUTES.DATASET_CREATION}
                    nextPage={PAGE_ROUTES.INITIAL_CODEBOOK}
                    isReady={true}
                    onNextClick={handleNextClick}
                />
            </div>
        </TutorialWrapper>
    );
};

export default CodebookCreation;

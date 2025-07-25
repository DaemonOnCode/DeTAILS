import { useRef, useEffect } from 'react';
import NavigationBottomBar from '../../components/Coding/Shared/navigation-bottom-bar';
import UnifiedCodingPage from '../../components/Coding/UnifiedCoding/unified-coding-section';
import { LOADER_ROUTES, PAGE_ROUTES, ROUTES } from '../../constants/Coding/shared';
import { useCodingContext } from '../../context/coding-context';
import { useLogger } from '../../context/logging-context';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import { createTimer } from '../../utility/timer';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { REMOTE_SERVER_ROUTES } from '../../constants/Shared';
import { getCodingLoaderUrl } from '../../utility/get-loader-url';
import TutorialWrapper from '../../components/Shared/tutorial-wrapper';
import { TutorialStep } from '../../components/Shared/custom-tutorial-overlay';
import { useLoadingContext } from '../../context/loading-context';
import { ROUTES as SHARED_ROUTES } from '../../constants/Shared';
import { useSettings } from '../../context/settings-context';
import { useNextHandler, useRetryHandler } from '../../hooks/Coding/use-handler-factory';

const InitialCoding = () => {
    const [searchParams] = useSearchParams();
    const reviewParam = searchParams.get('review') !== 'false';

    const { settings } = useSettings();

    const { dispatchSampledPostResponse, sampledPostIds } = useCodingContext();
    const location = useLocation();

    const logger = useLogger();
    const { saveWorkspaceData } = useWorkspaceUtils();
    const navigate = useNavigate();

    const { loadingState, loadingDispatch, checkIfDataExists, resetDataAfterPage, openModal } =
        useLoadingContext();
    const hasSavedRef = useRef(false);
    useEffect(() => {
        const timer = createTimer();
        logger.info('Initial coding Page Loaded');

        return () => {
            if (!hasSavedRef.current) {
                hasSavedRef.current = true;
                saveWorkspaceData().finally(() => {
                    hasSavedRef.current = false;
                });
            }
            logger.info('Initial coding Page Unloaded').then(() => {
                logger.time('Initial coding Page stay time', { time: timer.end() });
            });
        };
    }, []);

    const stepRoute = location.pathname;

    const handleRedoCoding = useRetryHandler({
        startLog: 'Starting redo initial coding',
        doneLog: 'Redo initial coding completed',
        loadingRoute: PAGE_ROUTES.INITIAL_CODING,
        loaderRoute: LOADER_ROUTES.FINAL_CODING_LOADER,
        loaderParams: { text: 'Initial Coding in Progress' },
        remoteRoute: REMOTE_SERVER_ROUTES.REDO_INITIAL_CODING,
        useLLM: true,
        buildBody: () => JSON.stringify({ model: settings.ai.model }),
        nextRoute: PAGE_ROUTES.INITIAL_CODING,
        onSuccess: (data) => console.log('Results:', data),
        onError: (error) => console.error('Error in handleRedoCoding:', error)
    });

    const handleNextClick = useNextHandler({
        startLog: 'Starting codebook generation',
        doneLog: 'Codebook generation completed',
        loadingRoute: PAGE_ROUTES.INITIAL_CODEBOOK,
        loaderRoute: LOADER_ROUTES.CODEBOOK_LOADER,
        remoteRoute: REMOTE_SERVER_ROUTES.GENERATE_CODEBOOK_WITHOUT_QUOTES,
        useLLM: true,
        buildBody: () => JSON.stringify({ model: settings.ai.model }),
        onSuccess: (data) => console.log('Results:', data)
    });

    const steps: TutorialStep[] = [
        {
            target: '#unified-coding-page',
            content: 'Edit/add codes.',
            placement: 'bottom'
        },
        {
            target: '#coding-controls',
            content: 'Use these controls to download codes or toggle between review and edit mode.',
            placement: 'bottom'
        },
        {
            target: '#redo-coding-btn',
            content: 'Provide feedback and redo entire coding.',
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
                getCodingLoaderUrl(LOADER_ROUTES.FINAL_CODING_LOADER, {
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
                        responseTypes={['sampled']}
                        // data={sampledPostResponse}
                        dispatchFunction={dispatchSampledPostResponse}
                        review={reviewParam}
                        showCoderType={false}
                        showCodebook={true}
                        showRerunCoding
                        handleRerun={async () => {
                            if (await checkIfDataExists(location.pathname)) {
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

export default InitialCoding;

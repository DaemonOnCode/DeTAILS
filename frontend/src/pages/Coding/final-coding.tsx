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
import { useSettings } from '../../context/settings-context';
import { useRetryHandler, useNextHandler } from '../../hooks/Coding/use-handler-factory';

const FinalCodingPage = () => {
    const [searchParams] = useSearchParams();
    const reviewParam = searchParams.get('review') !== 'false';

    const { dispatchUnseenPostResponse, unseenPostIds } = useCodingContext();
    const { settings } = useSettings();
    const location = useLocation();
    const logger = useLogger();
    const navigate = useNavigate();
    const { saveWorkspaceData } = useWorkspaceUtils();

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

    const handleRedoCoding = useRetryHandler({
        startLog: 'Starting redo coding',
        doneLog: 'Redo coding completed',
        loadingRoute: PAGE_ROUTES.FINAL_CODING,
        loaderRoute: LOADER_ROUTES.FINAL_CODING_LOADER,
        loaderParams: { text: 'Final Coding in Progress' },
        remoteRoute: REMOTE_SERVER_ROUTES.REDO_FINAL_CODING,
        useLLM: true,
        buildBody: () => JSON.stringify({ model: settings.ai.model }),
        nextRoute: PAGE_ROUTES.FINAL_CODING,
        onSuccess: (data) => console.log('Results:', data),
        onError: (error) => console.error('Error in handleRedoCoding:', error)
    });

    const handleNextClick = useNextHandler({
        startLog: 'Starting code grouping',
        doneLog: 'Code grouping completed',
        loadingRoute: PAGE_ROUTES.REVIEWING_CODES,
        loaderRoute: LOADER_ROUTES.DATA_LOADING_LOADER,
        loaderParams: { text: 'Reviewing codes' },
        remoteRoute: REMOTE_SERVER_ROUTES.GROUP_CODES,
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
                        responseTypes={['sampled_copy', 'unseen']}
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

import { useEffect, useImperativeHandle, useRef } from 'react';
import NavigationBottomBar from '../../components/Coding/Shared/navigation-bottom-bar';
import UnifiedCodingPage from '../../components/Coding/UnifiedCoding/unified-coding-section';
import { LOADER_ROUTES, PAGE_ROUTES } from '../../constants/Coding/shared';
import { useCodingContext } from '../../context/coding-context';
import { useLogger } from '../../context/logging-context';
import { createTimer } from '../../utility/timer';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { REMOTE_SERVER_ROUTES, MODEL_LIST } from '../../constants/Shared';
import { useCollectionContext } from '../../context/collection-context';
import useServerUtils from '../../hooks/Shared/get-server-url';
import { getCodingLoaderUrl } from '../../utility/get-loader-url';
import { TutorialStep } from '../../components/Shared/custom-tutorial-overlay';
import TutorialWrapper from '../../components/Shared/tutorial-wrapper';
import { StepHandle } from '../../types/Shared';
import { useLoadingContext } from '../../context/loading-context';
import { ROUTES as SHARED_ROUTES } from '../../constants/Shared';
import { toast } from 'react-toastify';
import { useApi } from '../../hooks/Shared/use-api';
import { useSettings } from '../../context/settings-context';
import { useWorkspaceContext } from '../../context/workspace-context';

const DeductiveCodingPage = () => {
    const [searchParams] = useSearchParams();
    const reviewParam = searchParams.get('review') !== 'false';

    const {
        unseenPostResponse,
        dispatchUnseenPostResponse,
        unseenPostIds,
        setGroupedCodes,
        setUnplacedSubCodes,
        sampledPostResponse,
        keywordTable,
        mainTopic,
        additionalInfo,
        researchQuestions
    } = useCodingContext();
    const { settings } = useSettings();
    const location = useLocation();
    const { currentWorkspace } = useWorkspaceContext();
    const logger = useLogger();
    const navigate = useNavigate();
    const { getServerUrl } = useServerUtils();
    const { datasetId } = useCollectionContext();
    const { saveWorkspaceData } = useWorkspaceUtils();
    const { fetchLLMData } = useApi();

    const { loadingState, loadingDispatch, openModal, resetDataAfterPage, checkIfDataExists } =
        useLoadingContext();
    const hasSavedRef = useRef(false);
    useEffect(() => {
        const timer = createTimer();
        logger.info('Deductive coding Page Loaded');

        return () => {
            if (!hasSavedRef.current) {
                hasSavedRef.current = true;
                saveWorkspaceData().finally(() => {
                    hasSavedRef.current = false;
                });
            }
            logger.info('Deductive coding Page Unloaded').then(() => {
                logger.time('Deductive coding Page stay time', { time: timer.end() });
            });
        };
    }, []);

    const stepRoute = location.pathname;

    const handleRedoCoding = async () => {
        navigate(
            getCodingLoaderUrl(LOADER_ROUTES.DEDUCTIVE_CODING_LOADER, {
                text: 'Final Coding in Progress'
            })
        );

        loadingDispatch({
            type: 'SET_LOADING_ROUTE',
            route: PAGE_ROUTES.DEDUCTIVE_CODING
        });

        const { data: results, error } = await fetchLLMData<{
            message: string;
            data: {
                id: string;
                postId: string;
                quote: string;
                explanation: string;
                code: string;
            }[];
        }>(REMOTE_SERVER_ROUTES.DEDUCTIVE_CODING, {
            method: 'POST',
            body: JSON.stringify({
                dataset_id: datasetId,
                model: settings.ai.model,
                workspace_id: currentWorkspace!.id,
                final_codebook: sampledPostResponse
                    .filter((response) => response.isMarked === true)
                    .map((response) => ({
                        post_id: response.postId,
                        quote: response.quote,
                        explanation: response.explanation,
                        code: response.code,
                        id: response.id
                    })),
                main_topic: mainTopic,
                additional_info: additionalInfo,
                research_questions: researchQuestions,
                keyword_table: keywordTable.filter(
                    (keywordRow) => keywordRow.isMarked !== undefined
                ),
                unseen_post_ids: unseenPostIds,
                current_codebook: unseenPostResponse.map((response) => ({
                    post_id: response.postId,
                    quote: response.quote,
                    explanation: response.explanation,
                    code: response.code,
                    id: response.id,
                    is_marked: response.isMarked
                }))
            })
        });

        if (error) {
            console.error('Error in handleRedoCoding:', error);
            if (error.name) {
                loadingDispatch({
                    type: 'SET_LOADING_DONE_ROUTE',
                    route: PAGE_ROUTES.DEDUCTIVE_CODING
                });
            }
            return;
        }

        console.log('Results:', results);

        // if (settings.general.manualCoding) {
        //     toast.info(
        //         'LLM has finished coding data. You can head back to Deductive Coding page to see the results',
        //         {
        //             autoClose: false
        //         }
        //     );
        // }

        dispatchUnseenPostResponse({
            type: 'SET_RESPONSES',
            responses: results['data'].map((response) => ({
                ...response,
                isMarked: true,
                type: 'LLM',
                comment: '',
                theme: ''
            }))
        });
        loadingDispatch({
            type: 'SET_LOADING_DONE_ROUTE',
            route: PAGE_ROUTES.DEDUCTIVE_CODING
        });
        navigate(PAGE_ROUTES.DEDUCTIVE_CODING);
    };

    const handleNextClick = async () => {
        loadingDispatch({
            type: 'SET_LOADING_ROUTE',
            route: PAGE_ROUTES.FINALIZING_CODES
        });
        navigate(
            getCodingLoaderUrl(LOADER_ROUTES.DATA_LOADING_LOADER, {
                text: 'Reviewing codes'
            })
        );

        const { data: results, error } = await fetchLLMData<{
            message: string;
            data: {
                higher_level_codes: any[];
                unplaced_codes: any[];
            };
        }>(REMOTE_SERVER_ROUTES.GROUP_CODES, {
            method: 'POST',
            body: JSON.stringify({
                dataset_id: datasetId,
                model: settings.ai.model,
                unseen_post_responses: unseenPostResponse,
                sampled_post_responses: sampledPostResponse
            })
        });

        if (error) {
            console.error('Error refreshing themes:', error);
            if (error.name !== 'AbortError') {
                toast.error('Error finalizing codes ' + (error.message ?? ''));
                navigate(PAGE_ROUTES.DEDUCTIVE_CODING);
                loadingDispatch({
                    type: 'SET_LOADING_DONE_ROUTE',
                    route: PAGE_ROUTES.FINALIZING_CODES
                });
                throw new Error(error.message);
            }
            return;
        }

        console.log('Results:', results);
        setGroupedCodes(results.data.higher_level_codes);
        setUnplacedSubCodes(results.data.unplaced_codes);

        loadingDispatch({
            type: 'SET_LOADING_DONE_ROUTE',
            route: PAGE_ROUTES.FINALIZING_CODES
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
            navigate(getCodingLoaderUrl(LOADER_ROUTES.DEDUCTIVE_CODING_LOADER));
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
            excludedTarget={`#route-${PAGE_ROUTES.DEDUCTIVE_CODING}`}>
            <div className="h-page flex flex-col">
                <div className="flex-1 overflow-hidden">
                    <UnifiedCodingPage
                        postIds={unseenPostIds}
                        data={unseenPostResponse}
                        dispatchFunction={dispatchUnseenPostResponse}
                        // showThemes
                        showRerunCoding
                        // split
                        review={reviewParam}
                        showCodebook
                        showFilterDropdown
                        applyFilters
                        coderType="LLM"
                        handleRerun={() => {
                            if (checkIfDataExists(location.pathname)) {
                                openModal('deductive-coding-redo', async () => {
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
                    nextPage={PAGE_ROUTES.FINALIZING_CODES}
                    isReady={true}
                    onNextClick={handleNextClick}
                />
            </div>
        </TutorialWrapper>
    );
};

export default DeductiveCodingPage;

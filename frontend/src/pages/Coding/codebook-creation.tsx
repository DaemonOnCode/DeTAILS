import { useRef, useEffect, useImperativeHandle } from 'react';
import NavigationBottomBar from '../../components/Coding/Shared/navigation-bottom-bar';
import UnifiedCodingPage from '../../components/Coding/UnifiedCoding/unified-coding-section';
import { LOADER_ROUTES, ROUTES } from '../../constants/Coding/shared';
import { useCodingContext } from '../../context/coding-context';
import { useLogger } from '../../context/logging-context';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import { createTimer } from '../../utility/timer';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { REMOTE_SERVER_ROUTES, MODEL_LIST } from '../../constants/Shared';
import { useCollectionContext } from '../../context/collection-context';
import useServerUtils from '../../hooks/Shared/get-server-url';
import { getCodingLoaderUrl } from '../../utility/get-loader-url';
import TutorialWrapper from '../../components/Shared/tutorial-wrapper';
import { TutorialStep } from '../../components/Shared/custom-tutorial-overlay';
import { StepHandle } from '../../types/Shared';
import { useLoadingContext } from '../../context/loading-context';
import { ROUTES as SHARED_ROUTES } from '../../constants/Shared';
import { useApi } from '../../hooks/Shared/use-api';
import { useSettings } from '../../context/settings-context';

const CodebookCreation = () => {
    const [searchParams] = useSearchParams();
    const reviewParam = searchParams.get('review') !== 'false';

    const { settings } = useSettings();

    const {
        sampledPostResponse,
        dispatchSampledPostResponse,
        sampledPostIds,
        setSampledPostResponseCopy,
        unseenPostIds,
        dispatchUnseenPostResponse,
        mainTopic,
        additionalInfo,
        researchQuestions,
        keywordTable
    } = useCodingContext();
    const location = useLocation();

    const logger = useLogger();
    const { saveWorkspaceData } = useWorkspaceUtils();
    const navigate = useNavigate();
    const { getServerUrl } = useServerUtils();
    const { datasetId } = useCollectionContext();
    const { fetchData } = useApi();

    const { loadingState, loadingDispatch, registerStepRef } = useLoadingContext();
    const hasSavedRef = useRef(false);
    useEffect(() => {
        const timer = createTimer();
        logger.info('Code Creation Page Loaded');

        return () => {
            if (!hasSavedRef.current) {
                saveWorkspaceData();
                hasSavedRef.current = true;
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
            route: `/${SHARED_ROUTES.CODING}/${ROUTES.CODEBOOK_CREATION}`
        });
        navigate(getCodingLoaderUrl(LOADER_ROUTES.CODEBOOK_LOADER));

        const { data: results, error } = await fetchData(REMOTE_SERVER_ROUTES.REMAKE_CODEBOOK, {
            method: 'POST',
            body: JSON.stringify({
                dataset_id: datasetId,
                keyword_table: keywordTable.filter((keyword) => keyword.isMarked !== undefined),
                model: settings.ai.model,
                main_topic: mainTopic,
                additional_info: additionalInfo,
                research_questions: researchQuestions,
                sampled_post_ids: sampledPostIds ?? [],
                codebook: sampledPostResponse.map((response) => ({
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
            loadingDispatch({
                type: 'SET_LOADING_DONE_ROUTE',
                route: `/${SHARED_ROUTES.CODING}/${ROUTES.CODEBOOK_CREATION}`
            });
            return;
        }

        console.log('Results:', results);

        dispatchSampledPostResponse({
            type: 'SET_RESPONSES',
            responses: results['data'].map((response: any) => ({ ...response, isMarked: true }))
        });
        loadingDispatch({
            type: 'SET_LOADING_DONE_ROUTE',
            route: `/${SHARED_ROUTES.CODING}/${ROUTES.CODEBOOK_CREATION}`
        });
        navigate(`/${SHARED_ROUTES.CODING}/${ROUTES.CODEBOOK_CREATION}`);
    };

    const handleNextClick = async () => {
        navigate(getCodingLoaderUrl(LOADER_ROUTES.DEDUCTIVE_CODING_LOADER));

        loadingDispatch({
            type: 'SET_LOADING_ROUTE',
            route: `/${SHARED_ROUTES.CODING}/${ROUTES.DEDUCTIVE_CODING}`
        });

        const { data: results, error } = await fetchData<{
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
                unseen_post_ids: unseenPostIds
            })
        });

        if (error) {
            console.error('Error in handleNextClick:', error);
            loadingDispatch({
                type: 'SET_LOADING_DONE_ROUTE',
                route: `/${SHARED_ROUTES.CODING}/${ROUTES.DEDUCTIVE_CODING}`
            });
            return;
        }

        console.log('Results:', results);

        toast.info(
            'LLM has finished coding data. You can head back to Deductive Coding page to see the results',
            {
                autoClose: false
            }
        );

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
        setSampledPostResponseCopy([...sampledPostResponse]);
        loadingDispatch({
            type: 'SET_LOADING_DONE_ROUTE',
            route: `/${SHARED_ROUTES.CODING}/${ROUTES.DEDUCTIVE_CODING}`
        });
    };

    // Define tutorial steps for Codebook Creation.
    // Note that some targets are rendered in UnifiedCodingPage.
    const steps: TutorialStep[] = [
        {
            target: '#unified-coding-page',
            content:
                'This area shows your unified coding interface with all your posts and coding responses.',
            placement: 'bottom'
        },
        {
            target: '#coding-controls',
            content:
                'Use these controls to download the codebook or toggle review mode for your coding responses.',
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
            navigate(getCodingLoaderUrl(LOADER_ROUTES.CODEBOOK_LOADER));
        }
    }, []);

    return (
        <TutorialWrapper steps={steps} pageId={location.pathname}>
            <div className="h-page flex flex-col">
                <div className="flex-1 overflow-hidden">
                    {/* Add an id to the container for tutorial targeting */}
                    {/* <div id="unified-coding-page"> */}
                    <UnifiedCodingPage
                        postIds={sampledPostIds}
                        data={sampledPostResponse}
                        dispatchFunction={dispatchSampledPostResponse}
                        review={reviewParam}
                        showCoderType={false}
                        showRerunCoding
                        handleRerun={handleRedoCoding}
                    />
                    {/* </div> */}
                </div>
                <NavigationBottomBar
                    previousPage={`${ROUTES.LOAD_DATA}/${ROUTES.DATASET_CREATION}`}
                    nextPage={`${ROUTES.DEDUCTIVE_CODING}`}
                    isReady={true}
                    onNextClick={handleNextClick}
                    autoNavigateToNext={!settings.general.manualCoding}
                />
            </div>
        </TutorialWrapper>
    );
};

export default CodebookCreation;

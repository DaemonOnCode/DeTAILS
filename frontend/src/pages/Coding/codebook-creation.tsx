import { useRef, useEffect } from 'react';
import NavigationBottomBar from '../../components/Coding/Shared/navigation-bottom-bar';
import UnifiedCodingPage from '../../components/Coding/UnifiedCoding/unified-coding-section';
import { LOADER_ROUTES, ROUTES } from '../../constants/Coding/shared';
import { useCodingContext } from '../../context/coding-context';
import { useLogger } from '../../context/logging-context';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import { createTimer } from '../../utility/timer';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { REMOTE_SERVER_ROUTES, MODEL_LIST } from '../../constants/Shared';
import { useCollectionContext } from '../../context/collection-context';
import useServerUtils from '../../hooks/Shared/get-server-url';
import { getCodingLoaderUrl } from '../../utility/get-loader-url';

const CodebookCreation = () => {
    const [searchParams] = useSearchParams();
    const reviewParam = searchParams.get('review') !== 'false';

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

    const logger = useLogger();

    const { saveWorkspaceData } = useWorkspaceUtils();
    const navigate = useNavigate();
    const { getServerUrl } = useServerUtils();
    const { datasetId } = useCollectionContext();

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

    const handleNextClick = async () => {
        navigate(getCodingLoaderUrl(LOADER_ROUTES.DEDUCTIVE_CODING_LOADER));

        const res = await fetch(getServerUrl(REMOTE_SERVER_ROUTES.DEDUCTIVE_CODING), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                dataset_id: datasetId,
                model: MODEL_LIST.GEMINI_FLASH,
                final_codebook: sampledPostResponse
                    .filter((response) => response.isMarked === true)
                    .map((response) => {
                        return {
                            post_id: response.postId,
                            quote: response.quote,
                            explanation: response.explanation,
                            code: response.code,
                            id: response.id
                        };
                    }),
                main_topic: mainTopic,
                additional_info: additionalInfo,
                research_questions: researchQuestions,
                keyword_table: keywordTable.filter(
                    (keywordRow) => keywordRow.isMarked !== undefined
                ),
                unseen_post_ids: unseenPostIds
            })
        });

        const results: {
            message: string;
            data: {
                id: string;
                postId: string;
                quote: string;
                explanation: string;
                code: string;
            }[];
        } = await res.json();
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
    };

    return (
        <div className="h-page flex flex-col">
            <div className="flex-1 overflow-hidden">
                <UnifiedCodingPage
                    postIds={sampledPostIds}
                    data={sampledPostResponse}
                    dispatchFunction={dispatchSampledPostResponse}
                    review={reviewParam}
                    showCoderType={false}
                    // showRerunCoding={true}
                />
            </div>
            <NavigationBottomBar
                previousPage={`${ROUTES.LOAD_DATA}/${ROUTES.DATASET_CREATION}`}
                nextPage={`${ROUTES.DEDUCTIVE_CODING}`}
                isReady={true}
                onNextClick={handleNextClick}
                autoNavigateToNext={false}
            />
        </div>
    );
};

export default CodebookCreation;

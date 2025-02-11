import { useEffect, useRef } from 'react';
import NavigationBottomBar from '../../components/Coding/Shared/navigation-bottom-bar';
import UnifiedCodingPage from '../../components/Coding/UnifiedCoding/unified-coding-section';
import { LOADER_ROUTES, ROUTES } from '../../constants/Coding/shared';
import { useCodingContext } from '../../context/coding-context';
import { useLogger } from '../../context/logging-context';
import { createTimer } from '../../utility/timer';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import { MODEL_LIST, REMOTE_SERVER_ROUTES } from '../../constants/Shared';
import { useNavigate } from 'react-router-dom';
import useServerUtils from '../../hooks/Shared/get-server-url';
import { useCollectionContext } from '../../context/collection-context';
import { ToastContainer, toast } from 'react-toastify';
import { getCodingLoaderUrl } from '../../utility/get-loader-url';

const FinalThemes = () => {
    const {
        sampledPostResponse,
        dispatchSampledPostResponse,
        sampledPostIds,
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
        logger.info('FInal codebook Page Loaded');

        return () => {
            if (!hasSavedRef.current) {
                saveWorkspaceData();
                hasSavedRef.current = true;
            }
            logger.info('FInal codebook Page Unloaded').then(() => {
                logger.time('FInal codebook Page stay time', { time: timer.end() });
            });
        };
    }, []);

    const InfiniteToast = () => {
        useEffect(() => {
            const showToast = () => {
                toast.info('🔥 Infinite Notification!', {
                    position: 'top-right',
                    autoClose: 3000, // Auto closes after 3 seconds
                    hideProgressBar: false,
                    closeOnClick: true,
                    pauseOnHover: true,
                    draggable: true,
                    progress: undefined
                });
            };

            // Show toast immediately
            showToast();

            // Set interval to continuously show toasts
            const toastInterval = setInterval(showToast, 5000); // Every 5 seconds

            return () => clearInterval(toastInterval); // Cleanup on unmount
        }, []);

        return <ToastContainer limit={3} />;
    };

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
            'LLM has finished coding data. You can head back to Split Check page to see the results',
            {
                autoClose: false
            }
        );

        dispatchUnseenPostResponse({
            type: 'SET_RESPONSES',
            responses: results['data'].map((response) => ({
                ...response,
                type: 'LLM'
            }))
        });
    };

    return (
        <div className="min-h-page">
            <div className="mb-6">
                <UnifiedCodingPage
                    postIds={sampledPostIds}
                    data={sampledPostResponse.filter((response) => response.isMarked === true)}
                    dispatchFunction={dispatchSampledPostResponse}
                    // showThemes
                    showCodebook
                    download
                />
            </div>
            <NavigationBottomBar
                previousPage={`${ROUTES.CODEBOOK_CREATION}/${ROUTES.CODEBOOK_REFINEMENT}`}
                nextPage={`${ROUTES.DEDUCTIVE_CODING}/${ROUTES.SPLIT_CHECK}`}
                isReady={true}
                onNextClick={handleNextClick}
            />
        </div>
    );
};

export default FinalThemes;

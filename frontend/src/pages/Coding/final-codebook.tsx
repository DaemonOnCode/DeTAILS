import { useEffect, useRef } from 'react';
import NavigationBottomBar from '../../components/Coding/Shared/navigation_bottom_bar';
import UnifiedCodingPage from '../../components/Coding/UnifiedCoding/unified-coding-section';
import { LOADER_ROUTES, ROUTES } from '../../constants/Coding/shared';
import { useCodingContext } from '../../context/coding_context';
import { useLogger } from '../../context/logging_context';
import { createTimer } from '../../utility/timer';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import { MODEL_LIST, REMOTE_SERVER_ROUTES } from '../../constants/Shared';
import { useNavigate } from 'react-router-dom';
import useServerUtils from '../../hooks/Shared/get_server_url';
import { useCollectionContext } from '../../context/collection_context';

const FinalThemes = () => {
    const {
        sampledPostResponse,
        dispatchSampledPostResponse,
        sampledPostIds,
        unseenPostIds,
        dispatchUnseenPostResponse
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

    const handleNextClick = async () => {
        navigate('../loader/' + LOADER_ROUTES.DEDUCTIVE_CODING_LOADER);

        const res = await fetch(getServerUrl(REMOTE_SERVER_ROUTES.DEDUCTIVE_CODING), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                dataset_id: datasetId,
                model: MODEL_LIST.DEEPSEEK_R1_32b,
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

        dispatchUnseenPostResponse({
            type: 'SET_RESPONSES',
            responses: results['data'].map((response) => ({
                ...response,
                type: 'LLM'
            }))
        });
    };

    return (
        <div>
            <div className="max-h-[calc(100vh-8rem)]">
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
                previousPage={ROUTES.THEMES}
                nextPage={ROUTES.SPLIT_CHECK}
                isReady={true}
                onNextClick={handleNextClick}
            />
        </div>
    );
};

export default FinalThemes;

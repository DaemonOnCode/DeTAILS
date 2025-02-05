import { useEffect, useRef } from 'react';
import NavigationBottomBar from '../../components/Coding/Shared/navigation-bottom-bar';
import UnifiedCodingPage from '../../components/Coding/UnifiedCoding/unified-coding-section';
import { LOADER_ROUTES, ROUTES } from '../../constants/Coding/shared';
import { useCodingContext } from '../../context/coding-context';
import { useLogger } from '../../context/logging-context';
import { createTimer } from '../../utility/timer';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import { useNavigate } from 'react-router-dom';
import getServerUtils from '../../hooks/Shared/get-server-url';
import { MODEL_LIST, REMOTE_SERVER_ROUTES } from '../../constants/Shared';
import { useCollectionContext } from '../../context/collection-context';

const CodebookRefinement = () => {
    const {
        sampledPostResponse,
        dispatchSampledPostResponse,
        sampledPostIds,
        sampledPostResponseCopy,
        setSampledPostResponseCopy
    } = useCodingContext();

    const navigate = useNavigate();
    const logger = useLogger();
    const { saveWorkspaceData } = useWorkspaceUtils();
    const { getServerUrl } = getServerUtils();
    const { datasetId } = useCollectionContext();

    const hasSavedRef = useRef(false);
    useEffect(() => {
        const timer = createTimer();
        logger.info('Code Refinement Loaded');

        return () => {
            if (!hasSavedRef.current) {
                saveWorkspaceData();
                hasSavedRef.current = true;
            }
            logger.info('Code Refinement Unloaded').then(() => {
                logger.time('Code Refinement stay time', { time: timer.end() });
            });
        };
    }, []);

    const handleRerun = async () => {
        navigate('../loader/' + LOADER_ROUTES.CODEBOOK_LOADER);

        console.log('Rerun coding', sampledPostResponseCopy, sampledPostResponse);

        const res = await fetch(getServerUrl(REMOTE_SERVER_ROUTES.REFINE_CODEBOOK), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                dataset_id: datasetId,
                model: MODEL_LIST.GEMINI,
                prevCodebook: sampledPostResponseCopy,
                currentCodebook: sampledPostResponse
            })
        });

        const results: {
            message: string;
            agreements: any;
            disagreements: any;
            data: any;
        } = await res.json();

        console.log('Results: refinement', results);

        setSampledPostResponseCopy([...sampledPostResponse]);

        dispatchSampledPostResponse({
            type: 'ADD_RESPONSES',
            responses: results.data
        });

        navigate('/coding/' + ROUTES.CODEBOOK_REFINEMENT);
    };

    return (
        <div>
            <div className="max-h-[calc(100vh-8rem)]">
                <UnifiedCodingPage
                    postIds={sampledPostIds}
                    data={sampledPostResponse}
                    dispatchFunction={dispatchSampledPostResponse}
                    review={false}
                    showRerunCoding
                    handleRerun={handleRerun}
                />
            </div>
            <NavigationBottomBar
                previousPage={ROUTES.CODES_REVIEW}
                nextPage={ROUTES.FINAL_CODEBOOK}
                isReady={true}
            />
        </div>
    );
};

export default CodebookRefinement;

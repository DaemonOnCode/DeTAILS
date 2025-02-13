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
import { getCodingLoaderUrl } from '../../utility/get-loader-url';

const CodebookRefinement = () => {
    const {
        sampledPostResponse,
        dispatchSampledPostResponse,
        sampledPostIds,
        sampledPostResponseCopy,
        setSampledPostResponseCopy,
        setConflictingResponses,
        conflictingResponses
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
        navigate(getCodingLoaderUrl(LOADER_ROUTES.CODEBOOK_LOADER));

        console.log('Rerun coding', sampledPostResponseCopy, sampledPostResponse);

        const res = await fetch(getServerUrl(REMOTE_SERVER_ROUTES.REFINE_CODEBOOK), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                dataset_id: datasetId,
                model: MODEL_LIST.GEMINI_FLASH,
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

        // dispatchSampledPostResponse({
        //     type: 'ADD_RESPONSES',
        //     responses: results.data
        // });

        setConflictingResponses(results.disagreements);

        navigate(`/coding/${ROUTES.CODEBOOK_CREATION}/${ROUTES.CODEBOOK_REFINEMENT}`);
    };

    const checkIfReady = conflictingResponses.length === 0;

    return (
        <div className="min-h-page">
            <div>
                <UnifiedCodingPage
                    postIds={sampledPostIds}
                    data={sampledPostResponse}
                    dispatchFunction={dispatchSampledPostResponse}
                    review={false}
                    showRerunCoding
                    handleRerun={handleRerun}
                    conflictingResponses={conflictingResponses}
                />
            </div>
            <NavigationBottomBar
                previousPage={`${ROUTES.CODEBOOK_CREATION}/${ROUTES.CODES_REVIEW}`}
                nextPage={`${ROUTES.CODEBOOK_CREATION}/${ROUTES.FINAL_CODEBOOK}`}
                isReady={checkIfReady}
            />
        </div>
    );
};

export default CodebookRefinement;

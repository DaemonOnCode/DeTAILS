import { useEffect, useRef } from 'react';
import NavigationBottomBar from '../../components/Coding/Shared/navigation-bottom-bar';
import UnifiedCodingPage from '../../components/Coding/UnifiedCoding/unified-coding-section';
import { ROUTES } from '../../constants/Coding/shared';
import { useCodingContext } from '../../context/coding-context';
import { useLogger } from '../../context/logging-context';
import { createTimer } from '../../utility/timer';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';

const FinalThemes = () => {
    const { sampledPostResponse, dispatchSampledPostResponse, sampledPostIds } = useCodingContext();

    const logger = useLogger();
    const { saveWorkspaceData } = useWorkspaceUtils();

    const hasSavedRef = useRef(false);
    useEffect(() => {
        const timer = createTimer();
        logger.info('Final codebook Page Loaded');

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
                // onNextClick={handleNextClick}
            />
        </div>
    );
};

export default FinalThemes;

import { useEffect, useRef } from 'react';
import NavigationBottomBar from '../../components/Coding/Shared/navigation_bottom_bar';
import UnifiedCodingPage from '../../components/Coding/UnifiedCoding/unified-coding-section';
import { ROUTES } from '../../constants/Coding/shared';
import { useCodingContext } from '../../context/coding_context';
import { useLogger } from '../../context/logging_context';
import { createTimer } from '../../utility/timer';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';

const CodebookRefinement = () => {
    const { sampledPostResponse, dispatchSampledPostResponse, sampledPostIds } = useCodingContext();

    const logger = useLogger();
    const { saveWorkspaceData } = useWorkspaceUtils();

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

    return (
        <div>
            <div className="max-h-[calc(100vh-8rem)]">
                <UnifiedCodingPage
                    postIds={sampledPostIds}
                    data={sampledPostResponse}
                    dispatchFunction={dispatchSampledPostResponse}
                    review={false}
                    showRerunCoding
                />
            </div>
            <NavigationBottomBar
                previousPage={ROUTES.CODES_REVIEW}
                nextPage={ROUTES.THEMES}
                isReady={true}
            />
        </div>
    );
};

export default CodebookRefinement;

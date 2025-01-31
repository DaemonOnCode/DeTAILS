import { useEffect, useRef } from 'react';
import NavigationBottomBar from '../../components/Coding/Shared/navigation_bottom_bar';
import UnifiedCodingPage from '../../components/Coding/UnifiedCoding/unified-coding-section';
import { ROUTES } from '../../constants/Coding/shared';
import { useCodingContext } from '../../context/coding_context';
import { createTimer } from '../../utility/timer';
import { useLogger } from '../../context/logging_context';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';

const CodeReview = () => {
    const {
        sampledPostResponse,
        dispatchSampledPostResponse,
        sampledPostIds,
        setSampledPostResponseCopy
    } = useCodingContext();

    const logger = useLogger();

    const { saveWorkspaceData } = useWorkspaceUtils();

    const hasSavedRef = useRef(false);
    useEffect(() => {
        const timer = createTimer();
        logger.info('Code Review Page Loaded');

        return () => {
            if (!hasSavedRef.current) {
                saveWorkspaceData();
                hasSavedRef.current = true;
            }
            logger.info('Code Review Page Unloaded').then(() => {
                logger.time('Code Review Page stay time', { time: timer.end() });
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
                    review={true}
                />
            </div>
            <NavigationBottomBar
                previousPage={ROUTES.KEYWORD_TABLE}
                nextPage={ROUTES.CODEBOOK_REFINEMENT}
                isReady={true}
                onNextClick={async () => {
                    setSampledPostResponseCopy([...sampledPostResponse]);
                }}
            />
        </div>
    );
};

export default CodeReview;

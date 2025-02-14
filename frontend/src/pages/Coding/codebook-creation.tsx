import { useRef, useEffect } from 'react';
import NavigationBottomBar from '../../components/Coding/Shared/navigation-bottom-bar';
import UnifiedCodingPage from '../../components/Coding/UnifiedCoding/unified-coding-section';
import { ROUTES } from '../../constants/Coding/shared';
import { useCodingContext } from '../../context/coding-context';
import { useLogger } from '../../context/logging-context';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import { createTimer } from '../../utility/timer';

const CodebookCreation = () => {
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

    return (
        <div className="h-page flex flex-col">
            <div className="flex-1 overflow-hidden">
                <UnifiedCodingPage
                    postIds={sampledPostIds}
                    data={sampledPostResponse}
                    dispatchFunction={dispatchSampledPostResponse}
                    review={true}
                />
            </div>
            <NavigationBottomBar
                previousPage={ROUTES.LOAD_DATA}
                nextPage={`${ROUTES.CODEBOOK_CREATION}/${ROUTES.CODEBOOK_REFINEMENT}`}
                isReady={true}
                onNextClick={async () => {
                    setSampledPostResponseCopy([...sampledPostResponse]);
                }}
            />
        </div>
    );
};

export default CodebookCreation;

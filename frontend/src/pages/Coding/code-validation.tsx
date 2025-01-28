import { useRef, useEffect } from 'react';
import NavigationBottomBar from '../../components/Coding/Shared/navigation_bottom_bar';
import UnifiedCodingPage from '../../components/Coding/UnifiedCoding/unified-coding-section';
import { ROUTES } from '../../constants/Coding/shared';
import { useCodingContext } from '../../context/coding_context';
import { useLogger } from '../../context/logging_context';
import { createTimer } from '../../utility/timer';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';

const CodeValidation = () => {
    const { unseenPostResponse, dispatchUnseenPostResponse, unseenPostIds } = useCodingContext();

    const logger = useLogger();
    const { saveWorkspaceData } = useWorkspaceUtils();

    const hasSavedRef = useRef(false);
    useEffect(() => {
        const timer = createTimer();
        logger.info('Code validation Page Loaded');

        return () => {
            if (!hasSavedRef.current) {
                saveWorkspaceData();
                hasSavedRef.current = true;
            }
            logger.info('Code validation Page Unloaded').then(() => {
                logger.time('Code validation Page stay time', { time: timer.end() });
            });
        };
    }, []);

    return (
        <div>
            <div className="max-h-[calc(100vh-8rem)]">
                <UnifiedCodingPage
                    postIds={unseenPostIds}
                    data={unseenPostResponse}
                    dispatchFunction={dispatchUnseenPostResponse}
                    review={false}
                    showThemes
                    showCodebook
                />
            </div>
            <NavigationBottomBar
                previousPage={ROUTES.HOME}
                nextPage={ROUTES.KEYWORD_CLOUD}
                isReady={true}
            />
        </div>
    );
};

export default CodeValidation;

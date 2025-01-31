import { useEffect, useRef } from 'react';
import NavigationBottomBar from '../../components/Coding/Shared/navigation_bottom_bar';
import UnifiedCodingPage from '../../components/Coding/UnifiedCoding/unified-coding-section';
import { ROUTES } from '../../constants/Coding/shared';
import { useCodingContext } from '../../context/coding_context';
import { useLogger } from '../../context/logging_context';
import { createTimer } from '../../utility/timer';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';

const SplitCheckPage = () => {
    const { unseenPostResponse, dispatchUnseenPostResponse, unseenPostIds } = useCodingContext();

    const logger = useLogger();
    const { saveWorkspaceData } = useWorkspaceUtils();

    const hasSavedRef = useRef(false);
    useEffect(() => {
        const timer = createTimer();
        logger.info('Split check Page Loaded');

        return () => {
            if (!hasSavedRef.current) {
                saveWorkspaceData();
                hasSavedRef.current = true;
            }
            logger.info('Split check Page Unloaded').then(() => {
                logger.time('Split check Page stay time', { time: timer.end() });
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
                    // showThemes
                    split
                    showCodebook
                    review={false}
                    showFilterDropdown
                />
            </div>
            <NavigationBottomBar
                previousPage={ROUTES.FINAL_CODEBOOK}
                nextPage={ROUTES.ENCODED_DATA}
                isReady={true}
            />
        </div>
    );
};

export default SplitCheckPage;

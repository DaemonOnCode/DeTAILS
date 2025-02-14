import { useEffect, useRef } from 'react';
import NavigationBottomBar from '../../components/Coding/Shared/navigation-bottom-bar';
import UnifiedCodingPage from '../../components/Coding/UnifiedCoding/unified-coding-section';
import { ROUTES } from '../../constants/Coding/shared';
import { useCodingContext } from '../../context/coding-context';
import { useLogger } from '../../context/logging-context';
import { createTimer } from '../../utility/timer';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';

const DeductiveCodingPage = () => {
    const { unseenPostResponse, dispatchUnseenPostResponse, unseenPostIds } = useCodingContext();

    const logger = useLogger();
    const { saveWorkspaceData } = useWorkspaceUtils();

    const hasSavedRef = useRef(false);
    useEffect(() => {
        const timer = createTimer();
        logger.info('Deductive coding Page Loaded');

        return () => {
            if (!hasSavedRef.current) {
                saveWorkspaceData();
                hasSavedRef.current = true;
            }
            logger.info('Deductive coding Page Unloaded').then(() => {
                logger.time('Deductive coding Page stay time', { time: timer.end() });
            });
        };
    }, []);

    return (
        <div className="h-page flex flex-col">
            <div className="flex-1 overflow-hidden">
                <UnifiedCodingPage
                    postIds={unseenPostIds}
                    data={unseenPostResponse}
                    dispatchFunction={dispatchUnseenPostResponse}
                    // showThemes
                    split
                    showCodebook
                    showFilterDropdown
                    showCoderType={false}
                    coderType="LLM"
                />
            </div>
            <NavigationBottomBar
                previousPage={`${ROUTES.CODEBOOK_CREATION}/${ROUTES.FINAL_CODEBOOK}`}
                nextPage={`${ROUTES.DEDUCTIVE_CODING}/${ROUTES.ENCODED_DATA}`}
                isReady={true}
            />
        </div>
    );
};

export default DeductiveCodingPage;

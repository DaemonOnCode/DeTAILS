import { useEffect, useRef } from 'react';
import NavigationBottomBar from '../../components/Coding/Shared/navigation_bottom_bar';
import UnifiedCodingPage from '../../components/Coding/UnifiedCoding/unified-coding-section';
import { ROUTES } from '../../constants/Coding/shared';
import { useCodingContext } from '../../context/coding_context';
import { useLogger } from '../../context/logging_context';
import { createTimer } from '../../utility/timer';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';

const FinalThemes = () => {
    const { sampledPostWithThemeResponse, dispatchSampledPostWithThemeResponse, sampledPostIds } =
        useCodingContext();

    const logger = useLogger();
    const { saveWorkspaceData } = useWorkspaceUtils();

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

    return (
        <div>
            <div className="max-h-[calc(100vh-8rem)]">
                <UnifiedCodingPage
                    postIds={sampledPostIds}
                    data={sampledPostWithThemeResponse}
                    dispatchFunction={dispatchSampledPostWithThemeResponse}
                    showThemes
                    showCodebook
                    download
                />
            </div>
            <NavigationBottomBar
                previousPage={ROUTES.THEMES}
                nextPage={ROUTES.SPLIT_CHECK}
                isReady={true}
            />
        </div>
    );
};

export default FinalThemes;

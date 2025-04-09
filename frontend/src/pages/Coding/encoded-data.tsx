import { useEffect, useRef } from 'react';
import NavigationBottomBar from '../../components/Coding/Shared/navigation-bottom-bar';
import UnifiedCodingPage from '../../components/Coding/UnifiedCoding/unified-coding-section';
import { LOADER_ROUTES, ROUTES } from '../../constants/Coding/shared';
import { useCodingContext } from '../../context/coding-context';
import { useLogger } from '../../context/logging-context';
import { createTimer } from '../../utility/timer';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import { useNavigate } from 'react-router-dom';
import { useCollectionContext } from '../../context/collection-context';
import useServerUtils from '../../hooks/Shared/get-server-url';
import { REMOTE_SERVER_ROUTES, MODEL_LIST } from '../../constants/Shared';
import { getCodingLoaderUrl } from '../../utility/get-loader-url';

const EncodedDataPage = () => {
    const {
        unseenPostResponse,
        dispatchUnseenPostResponse,
        unseenPostIds,
        setThemes,
        setUnplacedCodes,
        sampledPostResponse
    } = useCodingContext();

    const logger = useLogger();
    const { saveWorkspaceData } = useWorkspaceUtils();

    const hasSavedRef = useRef(false);
    useEffect(() => {
        const timer = createTimer();
        logger.info('Encoded data Page Loaded');

        return () => {
            if (!hasSavedRef.current) {
                hasSavedRef.current = true;
                saveWorkspaceData().finally(() => {
                    hasSavedRef.current = false;
                });
            }
            logger.info('Encoded data Page Unloaded').then(() => {
                logger.time('Encoded data Page stay time', { time: timer.end() });
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
                    showCodebook
                    // showThemes
                    split={false}
                />
            </div>
            <NavigationBottomBar
                previousPage={`${ROUTES.DEDUCTIVE_CODING}/${ROUTES.SPLIT_CHECK}`}
                nextPage={`${ROUTES.THEMATIC_ANALYSIS}/${ROUTES.THEMES}`}
                isReady={true}
            />
        </div>
    );
};

export default EncodedDataPage;

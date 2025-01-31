import { useEffect, useRef } from 'react';
import NavigationBottomBar from '../../components/Coding/Shared/navigation_bottom_bar';
import UnifiedCodingPage from '../../components/Coding/UnifiedCoding/unified-coding-section';
import { LOADER_ROUTES, ROUTES } from '../../constants/Coding/shared';
import { useCodingContext } from '../../context/coding_context';
import { useLogger } from '../../context/logging_context';
import { createTimer } from '../../utility/timer';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import { useNavigate } from 'react-router-dom';
import { useCollectionContext } from '../../context/collection_context';
import useServerUtils from '../../hooks/Shared/get_server_url';
import { REMOTE_SERVER_ROUTES, MODEL_LIST } from '../../constants/Shared';

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
    const navigate = useNavigate();
    const { getServerUrl } = useServerUtils();
    const { datasetId } = useCollectionContext();

    const hasSavedRef = useRef(false);
    useEffect(() => {
        const timer = createTimer();
        logger.info('Encoded data Page Loaded');

        return () => {
            if (!hasSavedRef.current) {
                saveWorkspaceData();
                hasSavedRef.current = true;
            }
            logger.info('Encoded data Page Unloaded').then(() => {
                logger.time('Encoded data Page stay time', { time: timer.end() });
            });
        };
    }, []);

    const handleNextClick = async () => {
        navigate('../loader/' + LOADER_ROUTES.THEME_GENERATION_LOADER);

        const res = await fetch(getServerUrl(REMOTE_SERVER_ROUTES.THEME_GENERATION), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                dataset_id: datasetId,
                model: MODEL_LIST.DEEPSEEK_R1_32b,
                unseen_post_responses: unseenPostResponse,
                sampled_post_responses: sampledPostResponse
            })
        });

        const results: {
            message: string;
            data: any;
        } = await res.json();
        console.log('Results:', results);

        setThemes(results.data.themes.map((theme: any) => ({ ...theme, name: theme.theme })));
        setUnplacedCodes(results.data.unplaced_codes);
    };

    return (
        <div>
            <div className="max-h-[calc(100vh-8rem)]">
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
                previousPage={ROUTES.SPLIT_CHECK}
                nextPage={ROUTES.THEMES}
                isReady={true}
                onNextClick={handleNextClick}
            />
        </div>
    );
};

export default EncodedDataPage;

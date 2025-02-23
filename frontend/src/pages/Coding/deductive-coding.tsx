import { useEffect, useRef } from 'react';
import NavigationBottomBar from '../../components/Coding/Shared/navigation-bottom-bar';
import UnifiedCodingPage from '../../components/Coding/UnifiedCoding/unified-coding-section';
import { LOADER_ROUTES, ROUTES } from '../../constants/Coding/shared';
import { useCodingContext } from '../../context/coding-context';
import { useLogger } from '../../context/logging-context';
import { createTimer } from '../../utility/timer';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { REMOTE_SERVER_ROUTES, MODEL_LIST } from '../../constants/Shared';
import { useCollectionContext } from '../../context/collection-context';
import useServerUtils from '../../hooks/Shared/get-server-url';
import { getCodingLoaderUrl } from '../../utility/get-loader-url';

const DeductiveCodingPage = () => {
    const [searchParams] = useSearchParams();
    const reviewParam = searchParams.get('review') !== 'false';

    const {
        unseenPostResponse,
        dispatchUnseenPostResponse,
        unseenPostIds,
        setThemes,
        setUnplacedCodes,
        sampledPostResponse
    } = useCodingContext();

    const logger = useLogger();
    const navigate = useNavigate();
    const { getServerUrl } = useServerUtils();
    const { datasetId } = useCollectionContext();
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

    const handleNextClick = async () => {
        navigate(getCodingLoaderUrl(LOADER_ROUTES.THEME_GENERATION_LOADER));

        const res = await fetch(getServerUrl(REMOTE_SERVER_ROUTES.THEME_GENERATION), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                dataset_id: datasetId,
                model: MODEL_LIST.GEMINI_FLASH,
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
        <div className="h-page flex flex-col">
            <div className="flex-1 overflow-hidden">
                <UnifiedCodingPage
                    postIds={unseenPostIds}
                    data={unseenPostResponse}
                    dispatchFunction={dispatchUnseenPostResponse}
                    // showThemes
                    split
                    review={reviewParam}
                    showCodebook
                    showFilterDropdown
                    applyFilters
                    coderType="LLM"
                />
            </div>
            <NavigationBottomBar
                previousPage={`${ROUTES.CODEBOOK_CREATION}`}
                nextPage={`${ROUTES.THEMATIC_ANALYSIS}/${ROUTES.THEMES}`}
                isReady={true}
                onNextClick={handleNextClick}
            />
        </div>
    );
};

export default DeductiveCodingPage;

import { useEffect, useImperativeHandle, useRef } from 'react';
import NavigationBottomBar from '../../components/Coding/Shared/navigation-bottom-bar';
import UnifiedCodingPage from '../../components/Coding/UnifiedCoding/unified-coding-section';
import { LOADER_ROUTES, ROUTES } from '../../constants/Coding/shared';
import { useCodingContext } from '../../context/coding-context';
import { useLogger } from '../../context/logging-context';
import { createTimer } from '../../utility/timer';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { REMOTE_SERVER_ROUTES, MODEL_LIST } from '../../constants/Shared';
import { useCollectionContext } from '../../context/collection-context';
import useServerUtils from '../../hooks/Shared/get-server-url';
import { getCodingLoaderUrl } from '../../utility/get-loader-url';
import { TutorialStep } from '../../components/Shared/custom-tutorial-overlay';
import TutorialWrapper from '../../components/Shared/tutorial-wrapper';
import { StepHandle } from '../../types/Shared';
import { useLoadingContext } from '../../context/loading-context';
import { ROUTES as SHARED_ROUTES } from '../../constants/Shared';

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
    const location = useLocation();

    const logger = useLogger();
    const navigate = useNavigate();
    const { getServerUrl } = useServerUtils();
    const { datasetId } = useCollectionContext();
    const { saveWorkspaceData } = useWorkspaceUtils();

    const { loadingState, loadingDispatch, registerStepRef } = useLoadingContext();
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

    const internalRef = useRef<StepHandle>(null);
    const stepRoute = location.pathname;

    const handleRedoCoding = async () => {};

    const handleNextClick = async () => {
        loadingDispatch({
            type: 'SET_LOADING_ROUTE',
            route: `/${SHARED_ROUTES.CODING}/${ROUTES.THEMATIC_ANALYSIS}/${ROUTES.THEMES}`
        });
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
        loadingDispatch({
            type: 'SET_LOADING_DONE_ROUTE',
            route: `/${SHARED_ROUTES.CODING}/${ROUTES.THEMATIC_ANALYSIS}/${ROUTES.THEMES}`
        });
    };

    const steps: TutorialStep[] = [
        {
            target: '#unified-coding-page',
            content:
                'This area shows your unified coding interface with all your posts and coding responses.',
            placement: 'bottom'
        },
        {
            target: '#coding-controls',
            content:
                'Use these controls to download the codebook or toggle review mode for your coding responses.',
            placement: 'top'
        },
        {
            target: '#proceed-next-step',
            content: 'Step 4: Proceed to next step',
            placement: 'top'
        }
    ];

    useEffect(() => {
        if (loadingState[stepRoute]?.isLoading) {
            navigate(getCodingLoaderUrl(LOADER_ROUTES.DEDUCTIVE_CODING_LOADER));
        }
    }, []);

    return (
        <TutorialWrapper steps={steps} pageId={location.pathname}>
            <div className="h-page flex flex-col">
                <div className="flex-1 overflow-hidden">
                    <UnifiedCodingPage
                        postIds={unseenPostIds}
                        data={unseenPostResponse}
                        dispatchFunction={dispatchUnseenPostResponse}
                        // showThemes
                        showRerunCoding
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
        </TutorialWrapper>
    );
};

export default DeductiveCodingPage;

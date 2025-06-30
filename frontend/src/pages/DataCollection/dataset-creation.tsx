import { useEffect, useRef } from 'react';
import { useCollectionContext } from '../../context/collection-context';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import NavigationBottomBar from '../../components/Coding/Shared/navigation-bottom-bar';
import {
    LOADER_ROUTES,
    PAGE_ROUTES,
    ROUTES,
    SELECTED_POSTS_MIN_THRESHOLD
} from '../../constants/Coding/shared';
import { REMOTE_SERVER_ROUTES } from '../../constants/Shared';
import { useCodingContext } from '../../context/coding-context';
import { ROUTES as SHARED_ROUTES } from '../../constants/Shared';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import { getCodingLoaderUrl } from '../../utility/get-loader-url';
import { TutorialStep } from '../../components/Shared/custom-tutorial-overlay';
import TutorialWrapper from '../../components/Shared/tutorial-wrapper';

import RedditTableRenderer from '../../components/Shared/reddit-table-renderer';
import useRedditData from '../../hooks/DataCollection/use-reddit-data';

import InterviewTableRenderer from '../../components/Shared/interview-table-renderer';
import useInterviewData from '../../hooks/DataCollection/use-interview-data';

import { useLoadingContext } from '../../context/loading-context';
import { useSettings } from '../../context/settings-context';
import { useWorkspaceContext } from '../../context/workspace-context';
import { useNextHandler } from '../../hooks/Coding/use-handler-factory';

const DatasetCreationPage = () => {
    const { type, selectedData, setSelectedData, modeInput, isLocked } = useCollectionContext();
    const navigate = useNavigate();
    const location = useLocation();
    const hasSavedRef = useRef(false);

    const { settings } = useSettings();
    const { saveWorkspaceData } = useWorkspaceUtils();
    const { currentWorkspace } = useWorkspaceContext();
    const { loadingState } = useLoadingContext();
    const { setSampledPostIds, setUnseenPostIds } = useCodingContext();

    const { loadFolderData, loadTorrentData } = useRedditData();

    const { loading: interviewLoading, error: interviewError } = useInterviewData();

    const [mainMode] = modeInput?.split('|') ?? [];
    console.log('Main mode:', mainMode);
    const isReddit = mainMode === 'reddit';
    const isInterview = mainMode === 'interview';

    const isReadyCheck = selectedData.length >= SELECTED_POSTS_MIN_THRESHOLD && isLocked;

    useEffect(() => {
        if (loadingState[location.pathname]?.isLoading) {
            if (isReddit) {
                const parts = modeInput.split('|');
                if (parts[1] === 'torrent') {
                    const loader =
                        parts[3] === 'files'
                            ? LOADER_ROUTES.REDDIT_DATA_LOADER
                            : LOADER_ROUTES.TORRENT_DATA_LOADER;
                    navigate(getCodingLoaderUrl(loader));
                } else {
                    navigate(getCodingLoaderUrl(LOADER_ROUTES.REDDIT_DATA_LOADER));
                }
            }
        } else {
            console.log(
                'Loading state is not active for this page:',
                location.pathname,
                isInterview,
                isReddit
            );
            if (isReddit) {
                const parts = modeInput.split('|');
                if (parts[1] === 'torrent') {
                    loadTorrentData();
                } else {
                    loadFolderData();
                }
            }
        }

        return () => {
            if (!hasSavedRef.current) {
                hasSavedRef.current = true;
                saveWorkspaceData().finally(() => {
                    hasSavedRef.current = false;
                });
            }
        };
    }, []);

    const handleSampling = useNextHandler({
        startLog: 'Sampling posts',
        doneLog: 'Sampling completed',
        loadingRoute: PAGE_ROUTES.INITIAL_CODING,
        loaderRoute: LOADER_ROUTES.FINAL_CODING_LOADER,
        loaderParams: { text: 'Initial Coding in Progress' },
        remoteRoute: REMOTE_SERVER_ROUTES.SAMPLE_POSTS,
        useLLM: false,
        buildBody: () =>
            JSON.stringify({
                workspace_id: currentWorkspace!.id,
                post_ids: selectedData,
                divisions: 2,
                sample_size: settings.general.sampleRatio
            }),
        onSuccess: (data: { sampled: string[]; unseen: string[] }) => {
            setSampledPostIds(data.sampled);
            setUnseenPostIds(data.unseen);
        },
        unsetLoadingDone: true
    });
    const handleGenerateInitialCodes = useNextHandler({
        startLog: 'Generating initial codes',
        doneLog: 'Initial codes generated',
        loadingRoute: PAGE_ROUTES.INITIAL_CODING,
        loaderRoute: LOADER_ROUTES.FINAL_CODING_LOADER,
        loaderParams: { text: 'Initial Coding in Progress' },
        remoteRoute: REMOTE_SERVER_ROUTES.GENERATE_INITIAL_CODES,
        useLLM: true,
        buildBody: () => JSON.stringify({ model: settings.ai.model }),
        onSuccess: (data) => console.log('Initial codes:', data)
    });

    const handleInterviewSampling = useNextHandler({
        startLog: 'Sampling interview files',
        doneLog: 'Interview sampling completed',
        loadingRoute: PAGE_ROUTES.INITIAL_CODING,
        loaderRoute: LOADER_ROUTES.FINAL_CODING_LOADER,
        loaderParams: { text: 'Interview Sampling in Progress' },
        remoteRoute: REMOTE_SERVER_ROUTES.SAMPLE_POSTS,
        useLLM: false,
        buildBody: () =>
            JSON.stringify({
                workspace_id: currentWorkspace!.id,
                file_ids: selectedData,
                divisions: 2,
                sample_size: settings.general.sampleRatio
            }),
        onSuccess: (data: { sampled: string[]; unseen: string[] }) => {
            setSampledPostIds(data.sampled);
            setUnseenPostIds(data.unseen);
        },
        unsetLoadingDone: true
    });

    if (loadingState[location.pathname]?.isFirstRun) {
        return (
            <p className="h-page w-full flex justify-center items-center">
                Please complete the previous page and click Proceed to continue.
            </p>
        );
    }

    if (!type || !modeInput) {
        return (
            <div className="flex flex-col items-center justify-center h-page">
                <p className="mb-4">Choose a data source to create your dataset.</p>
                <Link
                    to={`/${SHARED_ROUTES.CODING}/${ROUTES.LOAD_DATA}/${ROUTES.DATA_SOURCE}`}
                    className="text-blue-500">
                    Go back to Data source
                </Link>
            </div>
        );
    }

    const isDataLoaded = (isReddit && Boolean(modeInput)) || (isInterview && Boolean(modeInput));

    const steps: TutorialStep[] = [
        {
            target: '#viewer-main',
            content: 'Select the rows below to include in your coding sample.',
            placement: 'top'
        },
        {
            target: '#bottom-navigation',
            content: 'When ready, click Next to sample & proceed.',
            placement: 'top'
        }
    ];

    return (
        <TutorialWrapper
            steps={steps}
            pageId={location.pathname}
            excludedTarget={`#route-/${SHARED_ROUTES.CODING}/${ROUTES.LOAD_DATA}`}>
            <div className="h-page flex flex-col">
                <main id="viewer-main" className="flex-1 overflow-hidden">
                    {isDataLoaded && isReddit && (
                        <RedditTableRenderer
                            selectedData={selectedData}
                            setSelectedData={setSelectedData}
                        />
                    )}
                    {isDataLoaded && isInterview && (
                        <InterviewTableRenderer
                            selectedData={selectedData}
                            setSelectedData={setSelectedData}
                        />
                    )}
                    {isInterview && interviewError && (
                        <p className="text-red-600 text-center mt-4">
                            Failed to load interview files.
                        </p>
                    )}
                </main>

                <footer id="bottom-navigation">
                    <NavigationBottomBar
                        disabledTooltipText={
                            isReddit
                                ? 'Select at least 5 posts to proceed.'
                                : 'Select at least 5 files to proceed.'
                        }
                        previousPage={PAGE_ROUTES.DATA_SOURCE}
                        nextPage={PAGE_ROUTES.INITIAL_CODING}
                        isReady={isReadyCheck}
                        onNextClick={async () => {
                            if (isReddit) {
                                let err = await handleSampling();
                                if (err) return err;
                                err = await handleGenerateInitialCodes();
                                return err;
                            } else {
                                let err = await handleInterviewSampling();
                                if (err) return err;
                                err = await handleGenerateInitialCodes();
                                return err;
                            }
                        }}
                    />
                </footer>
            </div>
        </TutorialWrapper>
    );
};

export default DatasetCreationPage;

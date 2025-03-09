import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useCollectionContext } from '../../context/collection-context';
import { useNavigate, useSearchParams, Link, useLocation } from 'react-router-dom';
import LoadInterview from '../../components/DataCollection/load-interviews';
import NavigationBottomBar from '../../components/Coding/Shared/navigation-bottom-bar';
import {
    LOADER_ROUTES,
    ROUTES,
    SELECTED_POSTS_MIN_THRESHOLD,
    WORD_CLOUD_MIN_THRESHOLD
} from '../../constants/Coding/shared';
import { REMOTE_SERVER_ROUTES, MODEL_LIST } from '../../constants/Shared';
import { useCodingContext } from '../../context/coding-context';
import { ROUTES as SHARED_ROUTES } from '../../constants/Shared';
import { useLogger } from '../../context/logging-context';
import useServerUtils from '../../hooks/Shared/get-server-url';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import { getCodingLoaderUrl } from '../../utility/get-loader-url';
import CustomTutorialOverlay, {
    TutorialStep
} from '../../components/Shared/custom-tutorial-overlay';
import TutorialWrapper from '../../components/Shared/tutorial-wrapper';
import LoadReddit from '../../components/DataCollection/load-reddit';
import { useLoadingContext } from '../../context/loading-context';
import { StepHandle } from '../../types/Shared';

const UploadDataPage = () => {
    const { type, datasetId, selectedData, setModeInput, modeInput } = useCollectionContext();
    const [searchParams] = useSearchParams();
    // Determine dataset type from query parameter "type". If not provided, fallback to the modeInput's prefix.
    console.log('Selected mode:', modeInput);
    const datasetType = searchParams.get('type') ?? modeInput.split(':')[0];

    console.log('Selected data:', datasetType);
    const navigate = useNavigate();
    const {
        setSampledPostIds,
        setUnseenPostIds,
        keywordTable,
        mainTopic,
        additionalInfo,
        researchQuestions,
        dispatchSampledPostResponse
    } = useCodingContext();
    const logger = useLogger();
    const { saveWorkspaceData } = useWorkspaceUtils();
    const { getServerUrl } = useServerUtils();
    const { loadingState, loadingDispatch } = useLoadingContext();
    const location = useLocation();
    const hasSavedRef = useRef(false);

    const postIds: string[] = selectedData;

    const steps: TutorialStep[] =
        datasetType === 'reddit'
            ? [
                  {
                      target: '#upload-main',
                      content:
                          'Welcome to the Reddit Upload Page. Here you can select and load your data.',
                      placement: 'bottom'
                  },
                  {
                      target: '#reddit-dataset-tabs',
                      content:
                          'These tabs allow you to choose between loading data from a folder on your PC/Laptop or downloading from a torrent file containing all data.',
                      placement: 'bottom'
                  },
                  {
                      target: '#reddit-dataset-main',
                      content:
                          'In this area you can fill out the required information about the reddit dataset.',
                      placement: 'bottom'
                  },
                  {
                      target: '#proceed-next-step',
                      content: 'Proceed to next step',
                      placement: 'left'
                  }
              ]
            : datasetType === 'interview'
              ? []
              : [];

    useEffect(() => {
        return () => {
            if (!hasSavedRef.current) {
                hasSavedRef.current = true;
                saveWorkspaceData().then(() => {
                    hasSavedRef.current = false;
                });
            }
        };
    }, []);

    const processDataRef = useRef<{ run: () => Promise<void> } | null>(null);

    const handleButtonClick = async () => {
        if (!processDataRef.current?.run) return;
        loadingDispatch({
            type: 'SET_LOADING_ROUTE',
            route: `/${SHARED_ROUTES.CODING}/${ROUTES.LOAD_DATA}/${ROUTES.DATA_VIEWER}`
        });

        await processDataRef.current?.run();
        loadingDispatch({
            type: 'SET_LOADING_DONE_ROUTE',
            route: `/${SHARED_ROUTES.CODING}/${ROUTES.LOAD_DATA}/${ROUTES.DATA_VIEWER}`
        });
    };

    const stepRoute = location.pathname;

    // useEffect(() => {

    // }, []);

    // If no type is selected, prompt user to go back to home.
    if (!type) {
        return (
            <div className="flex flex-col items-center justify-center h-screen">
                <p className="text-xl mb-4">
                    No data type selected. Please return to the home page to select a type.
                </p>
                <button
                    onClick={() => navigate('/')}
                    className="px-4 py-2 bg-blue-500 text-white rounded">
                    Go Home
                </button>
            </div>
        );
    }

    return (
        <>
            <TutorialWrapper
                steps={steps}
                pageId={location.pathname}
                excludedTarget={`#route-/${SHARED_ROUTES.CODING}/${ROUTES.LOAD_DATA}`}>
                <div className="h-page flex flex-col">
                    <main id="upload-main" className="flex-1 overflow-hidden">
                        {datasetType === 'reddit' ? (
                            <LoadReddit processRef={processDataRef} />
                        ) : datasetType === 'interview' ? (
                            <LoadInterview />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-maxPageContent">
                                <p>Choose what type of data to retrieve from Data selection page</p>
                                <Link
                                    to={`/coding/${ROUTES.LOAD_DATA}/${ROUTES.DATA_SOURCE}`}
                                    className="text-blue-500">
                                    Go back to Data selection
                                </Link>
                            </div>
                        )}
                    </main>
                    <footer id="bottom-navigation">
                        <NavigationBottomBar
                            previousPage={`${ROUTES.LOAD_DATA}/${ROUTES.DATA_SOURCE}`}
                            nextPage={`${ROUTES.LOAD_DATA}/${ROUTES.DATA_VIEWER}`}
                            isReady={!!modeInput}
                            onNextClick={handleButtonClick}
                        />
                    </footer>
                </div>
            </TutorialWrapper>
        </>
    );
};

export default UploadDataPage;

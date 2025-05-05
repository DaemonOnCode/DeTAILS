import { useEffect, useRef } from 'react';
import { useCollectionContext } from '../../context/collection-context';
import { useNavigate, useSearchParams, Link, useLocation } from 'react-router-dom';
import LoadInterview from '../../components/DataCollection/load-interviews';
import NavigationBottomBar from '../../components/Coding/Shared/navigation-bottom-bar';
import { PAGE_ROUTES, ROUTES } from '../../constants/Coding/shared';
import { ROUTES as SHARED_ROUTES } from '../../constants/Shared';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import { TutorialStep } from '../../components/Shared/custom-tutorial-overlay';
import TutorialWrapper from '../../components/Shared/tutorial-wrapper';
import LoadReddit from '../../components/DataCollection/load-reddit';
import { useLoadingContext } from '../../context/loading-context';

const UploadDataPage = () => {
    const { type, modeInput } = useCollectionContext();
    const [searchParams] = useSearchParams();
    console.log('Selected mode:', modeInput, searchParams.get('type'), type);
    const datasetType = searchParams.get('type') ?? type ?? modeInput.split('|')[0];

    console.log('Selected data:', datasetType);
    const navigate = useNavigate();
    const { saveWorkspaceData } = useWorkspaceUtils();
    const { loadingState, loadingDispatch } = useLoadingContext();
    const location = useLocation();
    const hasSavedRef = useRef(false);

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
                saveWorkspaceData().finally(() => {
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
            route: PAGE_ROUTES.DATASET_CREATION
        });

        await processDataRef.current?.run();
        loadingDispatch({
            type: 'SET_LOADING_DONE_ROUTE',
            route: PAGE_ROUTES.DATASET_CREATION
        });
    };

    const stepRoute = location.pathname;

    if (loadingState[stepRoute]?.isFirstRun) {
        return (
            <p className="h-page w-full flex justify-center items-center">
                Please complete the previous page and click on proceed to continue with this page.
            </p>
        );
    }

    if (!type) {
        return (
            <div className="flex flex-col items-center justify-center h-screen">
                <p className="text-xl mb-4">
                    No data type selected. Please return to the home page to select a type.
                </p>
                <button
                    onClick={() => navigate(PAGE_ROUTES.DATA_TYPE)}
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
                                <Link to={PAGE_ROUTES.DATA_TYPE} className="text-blue-500">
                                    Go back to Data selection
                                </Link>
                            </div>
                        )}
                    </main>
                    <footer id="bottom-navigation">
                        <NavigationBottomBar
                            previousPage={PAGE_ROUTES.DATA_TYPE}
                            nextPage={`${PAGE_ROUTES.DATASET_CREATION}`}
                            isReady={
                                !!modeInput &&
                                (!modeInput.includes('upload') ||
                                    !modeInput.includes('undefined')) &&
                                (!modeInput.includes('torrent') ||
                                    (modeInput.includes('files') &&
                                        (modeInput.split('|files|')[1] ?? '')
                                            .split(',')
                                            .filter((file) => file.trim() !== '').length > 0))
                            }
                            onNextClick={handleButtonClick}
                        />
                    </footer>
                </div>
            </TutorialWrapper>
        </>
    );
};

export default UploadDataPage;

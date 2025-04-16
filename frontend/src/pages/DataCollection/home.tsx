import React, { useEffect, useRef } from 'react';
import Card from '../../components/DataCollection/card';
import { useLocation, useNavigate } from 'react-router-dom';
import { ROUTES as SHARED_ROUTES } from '../../constants/Shared';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import { useCollectionContext } from '../../context/collection-context';
import { ROUTES as CODING_ROUTES, PAGE_ROUTES } from '../../constants/Coding/shared';
import NavigationBottomBar from '../../components/Coding/Shared/navigation-bottom-bar';
import TutorialWrapper from '../../components/Shared/tutorial-wrapper';
import { TutorialStep } from '../../components/Shared/custom-tutorial-overlay';
import { useLoadingContext } from '../../context/loading-context';

const HomePage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const hasSavedRef = useRef(false);

    const { loadingState, loadingDispatch } = useLoadingContext();
    const { setType, modeInput } = useCollectionContext();

    const handleRedditRetrieval = () => {
        console.log('Retrieve Reddit clicked');
        if (!modeInput) setType('reddit');
        loadingDispatch({
            type: 'SET_FIRST_RUN_DONE',
            route: location.pathname
        });
        navigate(`${PAGE_ROUTES.DATA_SOURCE}?type=reddit`);
    };

    const handleInterviewImport = () => {
        console.log('Retrieve Interviews clicked');
        if (!modeInput) setType('interview');
        loadingDispatch({
            type: 'SET_FIRST_RUN_DONE',
            route: location.pathname
        });
        navigate(`${PAGE_ROUTES.DATA_SOURCE}?type=interview`);
    };

    const { saveWorkspaceData } = useWorkspaceUtils();

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

    const steps: TutorialStep[] = [
        {
            target: '#homepage-header',
            content: 'Welcome to the Data Import & Retrieval Tool.',
            placement: 'bottom'
        },
        {
            target: '#card-container',
            content:
                'These cards allow you to retrieve or import your data from various sources. Select on a card to proceed with dataset creation',
            placement: 'bottom'
        }
    ];

    if (loadingState[location.pathname]?.isFirstRun) {
        return (
            <p className="h-page w-full flex justify-center items-center">
                Please complete the previous page and click on proceed to continue with this page.
            </p>
        );
    }

    return (
        <TutorialWrapper
            steps={steps}
            excludedTarget={`#route-/${SHARED_ROUTES.CODING}/${CODING_ROUTES.LOAD_DATA}`}
            pageId={location.pathname}>
            <div className="bg-white text-gray-800 h-page flex flex-col items-center space-y-8 w-full">
                <h1 id="homepage-header" className="text-4xl font-bold text-center">
                    Data Import & Retrieval Tool
                </h1>

                <div className="flex flex-1 justify-center items-start flex-wrap gap-8 w-full max-w-screen-sm lg:max-w-screen-xl">
                    <div id="card-container">
                        <Card
                            title="Online Sources"
                            description="Retrieve online communities' public discussions (submissions and comments)."
                            buttonText="Retrieve Reddit"
                            buttonColor="bg-blue-500 hover:bg-blue-600"
                            onButtonClick={handleRedditRetrieval}
                        />
                    </div>
                </div>

                <footer className="w-full">
                    <NavigationBottomBar previousPage={PAGE_ROUTES.CONCEPT_OUTLINE} />
                </footer>
            </div>
        </TutorialWrapper>
    );
};

export default HomePage;

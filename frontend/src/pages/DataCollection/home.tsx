import React, { useEffect, useRef } from 'react';
import Card from '../../components/DataCollection/card';
import { useNavigate } from 'react-router-dom';
import { ROUTES as SHARED_ROUTES } from '../../constants/Shared';
import { ROUTES } from '../../constants/DataCollection/shared';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import { useCollectionContext } from '../../context/collection-context';
import { ROUTES as CODING_ROUTES } from '../../constants/Coding/shared';
import NavigationBottomBar from '../../components/Coding/Shared/navigation-bottom-bar';
// Import TutorialWrapper and TutorialStep from your shared components
import TutorialWrapper from '../../components/Shared/tutorial-wrapper';
import { TutorialStep } from '../../components/Shared/custom-tutorial-overlay';

const HomePage = () => {
    const navigate = useNavigate();
    const hasSavedRef = useRef(false);

    const { type, setType, modeInput } = useCollectionContext();

    // Event Handlers
    const handleRedditRetrieval = () => {
        console.log('Retrieve Reddit clicked');
        if (!modeInput) setType('reddit');
        navigate(
            `/coding/${CODING_ROUTES.LOAD_DATA}/${CODING_ROUTES.DATASET_CREATION}?type=reddit`
        );
    };

    const handleInterviewImport = () => {
        console.log('Retrieve Interviews clicked');
        if (!modeInput) setType('interview');
        navigate(
            `/coding/${CODING_ROUTES.LOAD_DATA}/${CODING_ROUTES.DATASET_CREATION}?type=interview`
        );
    };

    const handleCsvImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            console.log('Selected CSV file:', file);
            // Add file parsing logic here
        }
    };

    const handleModelImport = () => {
        console.log('Import BerTopic Model clicked');
        // Add BerTopic model import logic here
    };

    const { saveWorkspaceData } = useWorkspaceUtils();

    useEffect(() => {
        return () => {
            if (!hasSavedRef.current) {
                saveWorkspaceData();
                hasSavedRef.current = true;
            }
        };
    }, []);

    // Define tutorial steps for the Home page.
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
        },
        {
            target: '#proceed-next-step',
            content: 'Proceed to next step',
            placement: 'top'
        }
    ];

    return (
        <TutorialWrapper
            steps={steps}
            excludedTarget={`#route-/${SHARED_ROUTES.CODING}/${CODING_ROUTES.LOAD_DATA}`}
            pageId="home-page">
            <div className="bg-white text-gray-800 h-page flex flex-col items-center space-y-8 w-full">
                {/* Header */}
                <h1 id="homepage-header" className="text-4xl font-bold text-center">
                    Data Import & Retrieval Tool
                </h1>

                {/* Cards Container */}
                <div className="flex flex-1 justify-center items-start flex-wrap gap-8 w-full max-w-screen-sm lg:max-w-screen-xl">
                    {/* Online Sources */}
                    <div id="card-container">
                        <Card
                            title="Online Sources"
                            description="Retrieve online communities' public discussions (submissions and comments)."
                            buttonText="Retrieve Reddit"
                            buttonColor="bg-blue-500 hover:bg-blue-600"
                            onButtonClick={handleRedditRetrieval}
                        />
                    </div>

                    {/* You can uncomment and add more cards as needed */}

                    <Card
                        title="Interview Transcripts"
                        description="Retrieve interview transcripts from folder."
                        buttonText="Retrieve Interviews"
                        buttonColor="bg-blue-500 hover:bg-blue-600"
                        onButtonClick={handleInterviewImport}
                    />
                    {/*
                    <Card
                        title="Local Sources"
                        description="Import datasets created outside of this toolkit. The CSV files must be encoded using UTF-8."
                        inputType="file"
                        inputAccept=".csv"
                        onInputChange={handleCsvImport}
                    />

                    <Card
                        title="Model Sources"
                        description="Import a pre-trained BerTopic model for advanced text analysis."
                        buttonText="Import BerTopic Model"
                        buttonColor="bg-green-500 hover:bg-green-600"
                        onButtonClick={handleModelImport}
                    />
                    */}
                </div>

                <footer className="w-full">
                    <NavigationBottomBar
                        previousPage={`${CODING_ROUTES.BACKGROUND_RESEARCH}/${CODING_ROUTES.KEYWORD_TABLE}`}
                    />
                </footer>
            </div>
        </TutorialWrapper>
    );
};

export default HomePage;

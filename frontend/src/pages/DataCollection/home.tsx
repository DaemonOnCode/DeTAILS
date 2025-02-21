import React, { useEffect, useRef } from 'react';
import Card from '../../components/DataCollection/card';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants/DataCollection/shared';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import { useCollectionContext } from '../../context/collection-context';
import { ROUTES as CODING_ROUTES } from '../../constants/Coding/shared';

const HomePage = () => {
    const navigate = useNavigate();
    const hasSavedRef = useRef(false);

    const { type, setType, modeInput } = useCollectionContext();

    // Event Handlers
    const handleRedditRetrieval = () => {
        console.log('Retrieve Reddit clicked');
        if (!modeInput) setType('reddit');
        navigate(`/coding/${CODING_ROUTES.LOAD_DATA}/${ROUTES.UPLOAD_DATA}?type=reddit`);
        // navigate('/data-collection/' + ROUTES.LOAD_REDDIT);
    };

    const handleInterviewImport = () => {
        console.log('Retrieve Interviews clicked');
        if (!modeInput) setType('interview');
        navigate(`/coding/${CODING_ROUTES.LOAD_DATA}/${ROUTES.UPLOAD_DATA}?type=interview`);
        // navigate('/data-collection/' + ROUTES.LOAD_INTERVIEWS);
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

    return (
        <div className="bg-white text-gray-800 h-full flex flex-col items-center p-6 space-y-8">
            {/* Header */}
            <h1 className="text-4xl font-bold text-center">Data Import & Retrieval Tool</h1>

            {/* Cards Container */}
            <div className="flex justify-center items-center flex-wrap gap-8 w-full max-w-screen-sm lg:max-w-screen-xl">
                {/* Online Sources */}
                <Card
                    title="Online Sources"
                    description="Retrieve online communities' public discussions (submissions and comments)."
                    buttonText="Retrieve Reddit"
                    buttonColor="bg-blue-500 hover:bg-blue-600"
                    onButtonClick={handleRedditRetrieval}
                />

                {/* Online Sources */}
                {/* <Card
                    title="Interview Transcripts"
                    description="Retrieve interview transcripts from folder."
                    buttonText="Retrieve Interviews"
                    buttonColor="bg-blue-500 hover:bg-blue-600"
                    onButtonClick={handleInterviewImport}
                /> */}

                {/* Import CSV */}
                {/* <Card
                    title="Local Sources"
                    description="Import datasets created outside of this toolkit. The CSV files must be encoded using UTF-8."
                    inputType="file"
                    inputAccept=".csv"
                    onInputChange={handleCsvImport}
                /> */}

                {/* Import BerTopic Model */}
                {/* <Card
                    title="Model Sources"
                    description="Import a pre-trained BerTopic model for advanced text analysis."
                    buttonText="Import BerTopic Model"
                    buttonColor="bg-green-500 hover:bg-green-600"
                    onButtonClick={handleModelImport}
                /> */}
            </div>
        </div>
    );
};

export default HomePage;

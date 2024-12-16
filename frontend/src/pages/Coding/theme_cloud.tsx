import { FC, useContext, useEffect, useState } from 'react';
import { LOADER_ROUTES, ROUTES, WORD_CLOUD_MIN_THRESHOLD } from '../../constants/Coding/shared';
import NavigationBottomBar from '../../components/Coding/Shared/navigation_bottom_bar';
import ThemeCloud from '../../components/Coding/ThemeCloud/index';
import { DataContext } from '../../context/data_context';
import { useLogger } from '../../context/logging_context';
import { MODEL_LIST, REMOTE_SERVER_BASE_URL, REMOTE_SERVER_ROUTES, USE_LOCAL_SERVER } from '../../constants/Shared';
import { createTimer } from '../../utility/timer';
import { useCodingContext } from '../../context/coding_context';
import { useNavigate } from 'react-router-dom';
import { useCollectionContext } from '../../context/collection_context';

const { ipcRenderer } = window.require('electron');

const ThemeCloudPage: FC = () => {
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
    const [feedback, setFeedback] = useState('');

    const logger = useLogger();

    const navigate = useNavigate();

    const {mainCode, additionalInfo, selectedThemes, setSelectedThemes, setThemes, themes, dispatchCodeBook} = useCodingContext();
    const {datasetId} = useCollectionContext();

    // useEffect(() => {
    //     setSelectedThemes([mainCode]);
    // }, []);

    useEffect(() => {
        const timer = createTimer();
        logger.info('Loaded Theme cloud Page');

        return () => {
            logger.info('Unloaded Theme cloud Page').then(() => {
                logger.time('Theme cloud Page stay time', { time: timer.end() });
            });
        };
    }, []);

    const toggleThemeSelection = (word: string) => {
        if (word === mainCode) return;

        setSelectedThemes((prevSelected) =>
            prevSelected.includes(word)
                ? prevSelected.filter((w) => w !== word)
                : [...prevSelected, word]
        );
    };

    const handleFeedbackChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setFeedback(event.target.value);
    };

    const submitFeedback = () => {
        console.log('User feedback:', feedback);
        setFeedback('');
        setIsFeedbackOpen(false); // Close the modal

        refreshThemeCloud();
    };

    const refreshThemeCloud = async () => {
        await logger.info('Regenerating Theme Cloud');
        navigate("../loader/" + LOADER_ROUTES.THEME_LOADER);
        if(!USE_LOCAL_SERVER){
            // await ipcRenderer.invoke("connect-ws", datasetId);
            const res = await fetch(`${REMOTE_SERVER_BASE_URL}/${REMOTE_SERVER_ROUTES.GENERATE_THEMES}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: MODEL_LIST.LLAMA_3_2,
                    mainCode,
                    selectedThemes,
                    feedback,
                    dataset_id:datasetId
                })
            })

            const results = await res.json();
            console.log(results, 'Theme Cloud Page');

            // const parsedResults = JSON.parse(results);
            const newThemes: string[] = results.themes ?? [];

            setThemes((prevThemes) => {
                const filteredPrevThemes = prevThemes.filter((theme) =>
                    selectedThemes.includes(theme)
                );
                const filteredNewThemes = newThemes
                    .filter((theme) => !filteredPrevThemes.includes(theme));
                return [...filteredPrevThemes, ...filteredNewThemes];
            });
            // await ipcRenderer.invoke("disconnect-ws", datasetId);
            navigate("/coding/"+ROUTES.THEME_CLOUD);
            await logger.info('Theme Cloud refreshed');
            return;
        }

        console.log('Theme Cloud refreshed');
        await logger.info('Theme Cloud refreshed');
    };

    const refreshThemes = () => {
        // Open the feedback modal
        setIsFeedbackOpen(true);
    };

    const handleNextClick = async(e:any) => {
        e.preventDefault();
        await logger.info('Starting Codebook Generation');
        console.log('Navigating to codebook');
        // navigate(ROUTES.CODEBOOK);
        navigate('../loader/' + LOADER_ROUTES.CODEBOOK_LOADER);

        console.log('Sending request to server');
        if(!USE_LOCAL_SERVER){
            // await ipcRenderer.invoke("connect-ws", datasetId);
            console.log('Sending request to remote server');

            const res = await fetch(`${REMOTE_SERVER_BASE_URL}/${REMOTE_SERVER_ROUTES.GENERATE_CODEBOOK}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: MODEL_LIST.LLAMA_3_2,
                    mainCode,
                    additionalInfo,
                    selectedThemes,
                    dataset_id:datasetId
                }),
            });

            const results = await res.json();
            console.log(results, 'Theme Cloud Page');

            // const parsedResults = JSON.parse(results);
            const newCodebook: string[] = results.codebook;

            dispatchCodeBook({
                type: 'INITIALIZE',
                entries: newCodebook
            });
            await logger.info('Codebook Generation completed');
            return;
        }
    }

    const checkIfReady = selectedThemes.length > WORD_CLOUD_MIN_THRESHOLD;

    return (
        <div className="h-full flex justify-between flex-col">
            <div className="flex justify-center items-center flex-col">
                <div className="my-6 text-center">
                    <p>Select all of the words which you feel are similar to the main code</p>
                    <button
                        onClick={refreshThemes}
                        className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600  my-4">
                        Refresh word cloud
                    </button>
                </div>

                <ThemeCloud
                    mainCode={mainCode}
                    themes={themes}
                    selectedThemes={selectedThemes}
                    toggleThemeSelection={toggleThemeSelection}
                    setThemes={setThemes}
                />
            </div>

            <NavigationBottomBar
                previousPage={ROUTES.BASIS_V2}
                nextPage={ROUTES.CODEBOOK}
                isReady={checkIfReady}
                onNextClick={(e)=>handleNextClick(e)}
            />

            {isFeedbackOpen && (
                <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50">
                    <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
                        <h2 className="text-xl font-bold mb-4">
                            Why are these words unsatisfactory?
                        </h2>
                        <p className=" mb-3">
                            Word list:{' '}
                            {themes
                                .filter((theme) => !selectedThemes.includes(theme))
                                .join(', ')}
                        </p>
                        <textarea
                            value={feedback}
                            onChange={handleFeedbackChange}
                            className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            rows={4}
                            placeholder="Enter your feedback here..."></textarea>
                        <div className="flex justify-end mt-4">
                            <button
                                onClick={() => setIsFeedbackOpen(false)}
                                className="mr-4 bg-gray-300 px-4 py-2 rounded-md hover:bg-gray-400">
                                Cancel
                            </button>
                            <button
                                onClick={submitFeedback}
                                className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600">
                                Submit Feedback
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ThemeCloudPage;

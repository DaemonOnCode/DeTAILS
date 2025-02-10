import { FC, useEffect, useRef, useState } from 'react';
import { LOADER_ROUTES, ROUTES, WORD_CLOUD_MIN_THRESHOLD } from '../../constants/Coding/shared';
import NavigationBottomBar from '../../components/Coding/Shared/navigation-bottom-bar';
import KeywordCloud from '../../components/Coding/KeywordCloud/index';
import { useLogger } from '../../context/logging-context';
import { MODEL_LIST, REMOTE_SERVER_ROUTES } from '../../constants/Shared';
import { createTimer } from '../../utility/timer';
import { useCodingContext } from '../../context/coding-context';
import { useNavigate } from 'react-router-dom';
import { useCollectionContext } from '../../context/collection-context';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import getServerUtils from '../../hooks/Shared/get-server-url';
import { getCodingLoaderUrl } from '../../utility/get-loader-url';

const KeywordCloudPage: FC = () => {
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
    const [feedback, setFeedback] = useState('');

    const logger = useLogger();

    const navigate = useNavigate();

    const {
        mainTopic,
        additionalInfo,
        selectedKeywords,
        setSelectedKeywords,
        setKeywords,
        keywords,
        keywordTable,
        dispatchKeywordsTable,
        researchQuestions,
        selectedWords
    } = useCodingContext();
    const { datasetId } = useCollectionContext();

    const { saveWorkspaceData } = useWorkspaceUtils();

    const [response, setResponse] = useState<
        {
            word: string;
            description: string;
            inclusion_criteria: string[];
            exclusion_criteria: string[];
        }[]
    >(
        keywordTable.map((keyword) => ({
            word: keyword.word,
            description: keyword.description,
            inclusion_criteria: keyword.inclusion_criteria,
            exclusion_criteria: keyword.exclusion_criteria
        }))
    );

    // useEffect(() => {
    //     setSelectedKeywords([mainTopic]);
    // }, []);
    const { getServerUrl } = getServerUtils();

    const hasSavedRef = useRef(false);

    useEffect(() => {
        const timer = createTimer();
        logger.info('Loaded Keyword cloud Page');

        return () => {
            if (!hasSavedRef.current) {
                saveWorkspaceData();
                hasSavedRef.current = true;
            }
            logger.info('Unloaded Keyword cloud Page').then(() => {
                logger.time('Keyword cloud Page stay time', { time: timer.end() });
            });
        };
    }, []);

    const toggleKeywordSelection = (word: string) => {
        if (word === mainTopic) return;

        setSelectedKeywords((prevSelected) =>
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

        refreshKeywordCloud();
    };

    const refreshKeywordCloud = async () => {
        await logger.info('Regenerating Keyword Cloud');
        navigate('../loader/' + LOADER_ROUTES.THEME_LOADER);
        // if (!USE_LOCAL_SERVER) {
        // await ipcRenderer.invoke("connect-ws", datasetId);
        const res = await fetch(getServerUrl(REMOTE_SERVER_ROUTES.REGENERATE_KEYWORDS), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: MODEL_LIST.GEMINI_FLASH,
                mainTopic,
                additionalInfo,
                researchQuestions,
                unselectedKeywords: keywords.filter(
                    (keyword) => !selectedKeywords.includes(keyword)
                ),
                selectedKeywords,
                extraFeedback: feedback,
                datasetId
            })
        });

        const results = await res.json();
        console.log(results, 'Keyword Cloud Page');

        // const parsedResults = JSON.parse(results);
        const newKeywords: {
            word: string;
            description: string;
            inclusion_criteria: string[];
            exclusion_criteria: string[];
        }[] = results.keywords ?? [];

        setResponse((prevResponse) => [...prevResponse, ...newKeywords]);

        setKeywords((prevKeywords) => {
            const filteredPrevKeywords = prevKeywords.filter((keyword) =>
                selectedKeywords.includes(keyword)
            );
            const filteredNewKeywords = newKeywords
                .filter((keyword) => !filteredPrevKeywords.includes(keyword.word))
                .map((keyword) => keyword.word);
            return [...filteredPrevKeywords, ...filteredNewKeywords];
        });

        // await ipcRenderer.invoke("disconnect-ws", datasetId);
        navigate('/coding/' + ROUTES.KEYWORD_CLOUD);
        await logger.info('Keyword Cloud refreshed');
        //     return;
        // }

        console.log('Keyword Cloud refreshed');
        await logger.info('Keyword Cloud refreshed');
    };

    const refreshKeywords = () => {
        // Open the feedback modal
        setIsFeedbackOpen(true);
    };

    const handleNextClick = async (e: any) => {
        e.preventDefault();
        await logger.info('Starting Codebook Generation');
        console.log('Navigating to codebook');
        // navigate(ROUTES.CODEBOOK);
        navigate(getCodingLoaderUrl(LOADER_ROUTES.CODEBOOK_LOADER));

        console.log('Sending request to server');
        // if (!USE_LOCAL_SERVER) {
        // await ipcRenderer.invoke("connect-ws", datasetId);
        console.log('Sending request to remote server');

        // const res = await fetch(getServerUrl(REMOTE_SERVER_ROUTES.GENERATE_CODEBOOK), {
        //     method: 'POST',
        //     headers: {
        //         'Content-Type': 'application/json'
        //     },
        //     body: JSON.stringify({
        //         model: MODEL_LIST.GEMINI_FLASH,
        //         mainTopic,
        //         additionalInfo,
        //         selectedKeywords,
        //         dataset_id: datasetId
        //     })
        // });

        // const results = await res.json();
        // console.log(results, 'Keyword Cloud Page');

        // const parsedResults = JSON.parse(results);
        // const newCodebook: string[] = results.codebook;

        console.log('response', response, selectedKeywords);

        dispatchKeywordsTable({
            type: 'INITIALIZE',
            entries: response.filter((keyword) => selectedKeywords.includes(keyword.word))
        });
        await logger.info('Codebook Generation completed');
        //     return;
        // }
    };

    const checkIfReady = selectedKeywords.length > WORD_CLOUD_MIN_THRESHOLD;

    return (
        <div className="h-full flex justify-between flex-col">
            <div className="flex justify-center items-center flex-col">
                <div className="my-6 text-center">
                    <p>
                        Select all of the words which you feel are similar to the main topic of
                        interest
                    </p>
                    <button
                        onClick={refreshKeywords}
                        className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600  my-4">
                        Refresh keyword cloud
                    </button>
                </div>

                <KeywordCloud
                    mainTopic={mainTopic}
                    keywords={keywords}
                    selectedKeywords={selectedKeywords}
                    toggleKeywordSelection={toggleKeywordSelection}
                    setKeywords={setKeywords}
                />
            </div>

            <NavigationBottomBar
                previousPage={`${ROUTES.CONTEXT_BUILDER}/${ROUTES.CONTEXT_V2}`}
                nextPage={`${ROUTES.CONTEXT_BUILDER}/${ROUTES.KEYWORD_TABLE}`}
                isReady={checkIfReady}
                onNextClick={(e) => handleNextClick(e)}
            />

            {isFeedbackOpen && (
                <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50">
                    <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
                        <h2 className="text-xl font-bold mb-4">
                            Why are these words unsatisfactory?
                        </h2>
                        <p className=" mb-3">
                            Word list:{' '}
                            {keywords
                                .filter((keyword) => !selectedKeywords.includes(keyword))
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

export default KeywordCloudPage;

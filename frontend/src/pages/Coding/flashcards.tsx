import { useContext, useEffect, useState } from 'react';
import NavigationBottomBar from '../../components/Coding/Shared/navigation_bottom_bar';
import {
    FLASHCARDS_MIN_THRESHOLD,
    LOADER_ROUTES,
    ROUTES,
    initialFlashcards
} from '../../constants/Coding/shared';
import { DataContext } from '../../context/data_context';
import { useNavigate } from 'react-router-dom';
import { useLogger } from '../../context/logging_context';
import { MODEL_LIST, REMOTE_SERVER_BASE_URL, REMOTE_SERVER_ROUTES, USE_LOCAL_SERVER } from '../../constants/Shared';
import { createTimer } from '../../utility/timer';
import { useCodingContext } from '../../context/coding_context';

const { ipcRenderer } = window.require('electron');

const FlashcardsPage = () => {

    const navigate = useNavigate();
    // useEffect(() => {
    //     initialFlashcards.forEach(({ question, answer }) => {
    //         addFlashcard(question, answer);
    //     });
    // }, []);

    const { flashcards, removeFlashcard, selectedFlashcards, mainCode, additionalInfo, addFlashcard, setWords, deselectFlashcard, selectFlashcard } = useCodingContext();

    // const [modalOpen, setModalOpen] = useState(false);
    const [feedback, setFeedback] = useState('');
    // const [hovering, setHovering] = useState(false);

    const logger = useLogger();

    useEffect(() => {
        const timer = createTimer();
        logger.info('Loaded Flashcards Page');

        return () => {
            logger.info('Unloaded Flashcards Page').then(() => {
                logger.time('Flashcards Page stay time', { time: timer.end() });
            });
        };
    }, []);

    const generateFlashcards = async () => {
        for (const flashcard of flashcards) {
            if (selectedFlashcards.includes(flashcard.id)) continue;
            removeFlashcard(flashcard.id);
        }


        if(!USE_LOCAL_SERVER){
            console.log('Generating additional flashcards', selectedFlashcards, mainCode, additionalInfo, feedback);
            let res = await fetch(`${REMOTE_SERVER_BASE_URL}/${REMOTE_SERVER_ROUTES.REGENERATE_FLASHCARDS}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: MODEL_LIST.LLAMA_3_2,
                    mainCode,
                    additionalInfo,
                    flashcards: selectedFlashcards.map((id) => {
                        return {
                            question: flashcards.find((flashcard) => flashcard.id === id)!.question,
                            answer: flashcards.find((flashcard) => flashcard.id === id)!.answer
                        };
                    }),
                    feedback
                }),
            });
            let result: {
                flashcards: { question: string; answer: string }[];
            } = await res.json();
            console.log(result);

            if (result.flashcards){
                result.flashcards.forEach(({ question, answer }) => {
                    addFlashcard(question, answer);
                });
            }
            return;
        }

        let maxRetries = 5;
        const timer = createTimer();
        await logger.info('Generating additional flashcards');
        let result = await ipcRenderer.invoke(
            'generate-additional-flashcards',
            MODEL_LIST.LLAMA_3_2,
            mainCode,
            additionalInfo,
            selectedFlashcards.map((id) => {
                return {
                    question: flashcards.find((flashcard) => flashcard.id === id)!.question,
                    answer: flashcards.find((flashcard) => flashcard.id === id)!.answer
                };
            }),
            feedback
        );

        await logger.time('Generated additional flashcards: Initial', { time: timer.end() });

        console.log(result);

        let parsedResult: { flashcards: { question: string; answer: string }[] } =
            JSON.parse(result);

        while (parsedResult.flashcards.length === 0 && maxRetries > 0) {
            await logger.warning('Failed to generate additional flashcards', { maxRetries });
            await logger.info('Retrying flashcards', { maxRetries });
            timer.reset();
            result = await ipcRenderer.invoke(
                'generate-additional-flashcards',
                MODEL_LIST.LLAMA_3_2,
                mainCode,
                additionalInfo,
                selectedFlashcards.map((id) => {
                    return {
                        question: flashcards.find((flashcard) => flashcard.id === id)!.question,
                        answer: flashcards.find((flashcard) => flashcard.id === id)!.answer
                    };
                }),
                feedback
            );
            await logger.time(`Generated additional flashcards: Retry ${maxRetries}`, {
                time: timer.end()
            });
            parsedResult = JSON.parse(result);
            maxRetries--;
        }
        parsedResult.flashcards.forEach(({ question, answer }) => {
            addFlashcard(question, answer);
        });

        console.log('Flashcards regenerated', parsedResult);
    };

    const handleGenerateAdditionalFlashcards = (e: any) => {
        e.preventDefault();
        generateFlashcards();
    };

    const handleGenerateWords = async (e: any) => {
        e.preventDefault();
        navigate('../loader/' + LOADER_ROUTES.WORD_CLOUD_LOADER);
        const flashcardData = selectedFlashcards.map((id) => {
            return {
                question: flashcards.find((flashcard) => flashcard.id === id)!.question,
                answer: flashcards.find((flashcard) => flashcard.id === id)!.answer
            };
        });

        let maxRetries = 5;
        let result;
        let parsedResult = { words: [] };


        if(!USE_LOCAL_SERVER){
            console.log('Generating word cloud', mainCode, flashcardData);
            let res = await fetch(`${REMOTE_SERVER_BASE_URL}/${REMOTE_SERVER_ROUTES.GENERATE_WORDS}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: MODEL_LIST.LLAMA_3_2,
                    mainCode,
                    flashcards: flashcardData
                }),
            });
            result = await res.json();
            console.log(result, 'Initial result from generate-words');
            // parsedResult = JSON.parse(result);
            if (result.words.length > 0) {
                setWords(result.words);
            } else {
                console.error('Failed to generate words after retries');
            }
            return;
        }


        const timer = createTimer();
        try {
            result = await ipcRenderer.invoke(
                'generate-words',
                MODEL_LIST.LLAMA_3_2,
                mainCode,
                flashcardData
            );
            await logger.time('Word cloud generation: Initial', { time: timer.end() });
            console.log(result, 'Initial result from generate-words');
            parsedResult = JSON.parse(result);
        } catch (e) {
            console.log(e, 'Error invoking generate-words');
            return;
        }

        console.log(parsedResult, 'Parsed result from generate-words');
        while (parsedResult.words.length === 0 && maxRetries > 0) {
            // try {
            //     if (!result || result === 'undefined') {
            //         throw new Error('Result is undefined or invalid');
            //     }

            //     parsedResult = JSON.parse(result);

            //     if (!Array.isArray(parsedResult.words)) {
            //         throw new Error('Parsed result does not contain a valid words array');
            //     }
            // } catch (e) {
            // console.log('Error parsing result or validating parsedResult');

            // if (maxRetries > 0) {
            console.log('Retrying word cloud generation', maxRetries);
            await logger.warning('Retrying word cloud generation', { maxRetries });
            timer.reset();
            try {
                result = await ipcRenderer.invoke(
                    'generate-words',
                    MODEL_LIST.LLAMA_3_2,
                    mainCode,
                    flashcardData,
                    true
                );
                await logger.time(`Word cloud generation: Retry ${maxRetries}`, {
                    time: timer.end()
                });
            } catch (retryError) {
                console.log(retryError, 'Error invoking generate-words on retry');
                // continue;
            }
            // } else {
            //     console.error('Max retries reached. Exiting.');
            //     return;
            // }
            // // }
            maxRetries--;
        }

        console.log(parsedResult, 'Final parsed result from generate-words');
        if (parsedResult.words.length > 0) {
            setWords(parsedResult.words);
        } else {
            console.error('Failed to generate words after retries');
        }
    };

    const isReadyCheck = selectedFlashcards.length >= FLASHCARDS_MIN_THRESHOLD;

    return (
        <div className="h-full flex justify-between flex-col">
            <div className="flex flex-col justify-between items-center gap-y-6">
                <p>Flashcards</p>
                <div className="flex items-center justify-center max-h-[calc(100vh-20rem)]">
                    <div className="w-full h-full overflow-auto rounded-lg">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
                            {flashcards.map((flashcard) => {
                                const isSelected = selectedFlashcards.includes(flashcard.id);

                                return (
                                    <div
                                        key={flashcard.id}
                                        onClick={() =>
                                            isSelected
                                                ? deselectFlashcard(flashcard.id)
                                                : selectFlashcard(flashcard.id)
                                        }
                                        className={`p-4 border rounded-md bg-gray-50 shadow-md cursor-pointer ${
                                            isSelected
                                                ? 'border-green-500 bg-green-50'
                                                : 'border-gray-300'
                                        }`}>
                                        <h2 className="text-lg font-semibold text-gray-800">
                                            Question: {flashcard.question}
                                        </h2>
                                        <p className="mt-2 text-gray-600">
                                            <strong>Answer:</strong> {flashcard.answer}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
                <div className="flex items-center w-full gap-x-4">
                    <textarea
                        className="flex-grow p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                        placeholder="To receive better flashcards, please explain why you selected the flashcards you did..."
                        rows={4}
                        onChange={(e) => setFeedback(e.target.value)}
                    />
                    <div className="relative">
                        <button
                            className={`px-4 py-2 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-75`}
                            onClick={handleGenerateAdditionalFlashcards}
                            // disabled={!feedback}
                            // onMouseOver={() => setHovering(true)}
                            // onMouseLeave={() => setHovering(false)}
                        >
                            Generate additional Flashcards
                        </button>
                        {/* {!feedback && hovering && (
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 w-max bg-gray-800 text-white text-sm py-1 px-2 rounded-md shadow-lg">
                                You need to fill feedback
                            </div>
                        )} */}
                    </div>
                </div>
            </div>
            <NavigationBottomBar
                previousPage={ROUTES.BASIS}
                nextPage={ROUTES.WORD_CLOUD}
                isReady={isReadyCheck}
                onNextClick={handleGenerateWords}
            />
            {/* {modalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white w-full max-w-md p-6 rounded-lg shadow-lg">
                        <h2 className="text-lg font-semibold text-gray-800 mb-4">
                            Why were the selected flashcards not good?
                        </h2>
                        <textarea
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                            placeholder="Provide your feedback here..."
                            className="w-full h-32 p-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"></textarea>
                        <div className="mt-4 flex justify-end gap-4">
                            <button
                                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 focus:outline-none"
                                onClick={() => setModalOpen(false)}>
                                Cancel
                            </button>
                            <button
                                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none"
                                onClick={() => {
                                    setModalOpen(false);
                                    regenerate();
                                }}>
                                Submit
                            </button>
                        </div>
                    </div>
                </div>
            )} */}
        </div>
    );
};

export default FlashcardsPage;

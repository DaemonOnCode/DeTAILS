import { useContext, useEffect, useState } from 'react';
import NavigationBottomBar from '../components/Shared/navigation_bottom_bar';
import {
    FLASHCARDS_MIN_THRESHOLD,
    LOADER_ROUTES,
    ROUTES,
    initialFlashcards
} from '../constants/shared';
import { DataContext } from '../context/data_context';

const { ipcRenderer } = window.require('electron');

const FlashcardsPage = () => {
    const dataContext = useContext(DataContext);

    useEffect(() => {
        initialFlashcards.forEach(({ question, answer }) => {
            dataContext.addFlashcard(question, answer);
        });
    }, []);

    const { flashcards, selectedFlashcards, selectFlashcard, deselectFlashcard } = dataContext;

    // const [modalOpen, setModalOpen] = useState(false);
    const [feedback, setFeedback] = useState('');
    // const [hovering, setHovering] = useState(false);

    const generateFlashcards = async () => {
        for (const flashcard of flashcards) {
            if (selectedFlashcards.includes(flashcard.id)) continue;
            dataContext.removeFlashcard(flashcard.id);
        }
        let maxRetries = 5;
        let result = await ipcRenderer.invoke(
            'generate-additional-flashcards',
            'llama3.2:3b',
            dataContext.mainCode,
            dataContext.additionalInfo,
            selectedFlashcards.map((id) => {
                return {
                    question: flashcards.find((flashcard) => flashcard.id === id)!.question,
                    answer: flashcards.find((flashcard) => flashcard.id === id)!.answer
                };
            }),
            feedback
        );

        console.log(result);

        let parsedResult: { flashcards: { question: string; answer: string }[] } =
            JSON.parse(result);

        while (parsedResult.flashcards.length === 0 && maxRetries > 0) {
            result = await ipcRenderer.invoke(
                'generate-additional-flashcards',
                'llama3.2:3b',
                dataContext.mainCode,
                dataContext.additionalInfo,
                selectedFlashcards.map((id) => {
                    return {
                        question: flashcards.find((flashcard) => flashcard.id === id)!.question,
                        answer: flashcards.find((flashcard) => flashcard.id === id)!.answer
                    };
                }),
                feedback
            );
            parsedResult = JSON.parse(result);
            maxRetries--;
        }
        parsedResult.flashcards.forEach(({ question, answer }) => {
            dataContext.addFlashcard(question, answer);
        });

        console.log('Flashcards regenerated', parsedResult);
    };

    const handleGenerateAdditionalFlashcards = (e: any) => {
        e.preventDefault();
        generateFlashcards();
    };

    const isReadyCheck = selectedFlashcards.length >= FLASHCARDS_MIN_THRESHOLD;

    return (
        <div className="p-6 h-full flex justify-between flex-col">
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
                nextPage={LOADER_ROUTES.WORD_CLOUD_LOADER}
                isReady={isReadyCheck}
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

import { FC, useContext, useEffect, useState } from 'react';
import { ROUTES, WORD_CLOUD_MIN_THRESHOLD, newWordsPool } from '../../constants/Coding/shared';
import NavigationBottomBar from '../../components/Coding/Shared/navigation_bottom_bar';
import WordCloud from '../../components/Coding/WordCloud/index';
import { DataContext } from '../../context/data_context';

const { ipcRenderer } = window.require('electron');

const WordCloudPage: FC = () => {
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
    const [feedback, setFeedback] = useState('');

    const dataContext = useContext(DataContext);

    // useEffect(() => {
    //     dataContext.setSelectedWords([dataContext.mainCode]);
    // }, []);

    const toggleWordSelection = (word: string) => {
        if (word === dataContext.mainCode) return;

        dataContext.setSelectedWords((prevSelected) =>
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

        refreshWordCloud();
    };

    const refreshWordCloud = async () => {
        const results = await ipcRenderer.invoke(
            'generate-words',
            'llama3.2:3b',
            dataContext.mainCode,
            newWordsPool,
            null,
            true,
            dataContext.selectedWords,
            feedback
        );

        console.log(results, 'Word Cloud Page');

        let newWords: string[] = [];

        try {
            const parsedResults = JSON.parse(results);
            newWords = parsedResults.words;
        } catch (e) {
            console.log(e, 'Error parsing results');
        }

        dataContext.setWords((prevWords) => {
            const filteredPrevWords = prevWords.filter((word) =>
                dataContext.selectedWords.includes(word)
            );
            const filteredNewWords = newWords
                .filter((word) => !filteredPrevWords.includes(word))
                .slice(0, 20 - filteredPrevWords.length);
            return [...filteredPrevWords, ...filteredNewWords];
        });

        console.log('Word Cloud refreshed');
    };

    const refreshWords = () => {
        // Open the feedback modal
        setIsFeedbackOpen(true);
    };

    const checkIfReady = dataContext.selectedWords.length > WORD_CLOUD_MIN_THRESHOLD;

    return (
        <div className="p-6 h-full flex justify-between flex-col">
            <div className="flex justify-center items-center flex-col">
                <div className="my-6 text-center">
                    <p>Select all of the words which you feel are similar to the main word</p>
                    <button
                        onClick={refreshWords}
                        className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600  my-4">
                        Refresh word cloud
                    </button>
                </div>

                <WordCloud
                    mainCode={dataContext.mainCode}
                    words={dataContext.words}
                    selectedWords={dataContext.selectedWords}
                    toggleWordSelection={toggleWordSelection}
                />
            </div>

            <NavigationBottomBar
                previousPage={ROUTES.FLASHCARDS}
                nextPage={ROUTES.INITIAL_CODING}
                isReady={checkIfReady}
            />

            {isFeedbackOpen && (
                <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50">
                    <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
                        <h2 className="text-xl font-bold mb-4">
                            Why are these words unsatisfactory?
                        </h2>
                        <p className=" mb-3">
                            Word list:{' '}
                            {dataContext.words
                                .filter((word) => !dataContext.selectedWords.includes(word))
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

export default WordCloudPage;

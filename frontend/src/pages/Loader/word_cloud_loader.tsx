import { useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants/shared';
import { DataContext } from '../../context/data_context';

const { ipcRenderer } = window.require('electron');

const WordCloudLoaderPage = () => {
    const dataContext = useContext(DataContext);

    const navigate = useNavigate();

    const handleGenerateWords = async () => {
        const flashcardData = dataContext.selectedFlashcards.map((id) => {
            return {
                question: dataContext.flashcards[id].question,
                answer: dataContext.flashcards[id].answer
            };
        });

        let maxRetries = 5;
        let result;
        let parsedResult = { words: [] };

        try {
            result = await ipcRenderer.invoke(
                'generate-words',
                'llama3.2:3b',
                dataContext.mainCode,
                flashcardData
            );
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
            try {
                result = await ipcRenderer.invoke(
                    'generate-words',
                    'llama3.2:3b',
                    dataContext.mainCode,
                    flashcardData,
                    true
                );
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
            dataContext.setWords(parsedResult.words);
            navigate(ROUTES.WORD_CLOUD.substring(1));
        } else {
            console.error('Failed to generate words after retries');
        }
    };

    useEffect(() => {
        console.log('Word Cloud Loader Page');
        handleGenerateWords();
    }, []);

    return (
        <div>
            <h1>Word Cloud Loader</h1>
        </div>
    );
};

export default WordCloudLoaderPage;

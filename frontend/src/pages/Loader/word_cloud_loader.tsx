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
        const result = await ipcRenderer.invoke(
            'generate-words',
            'llama3.2:3b',
            dataContext.mainCode,
            flashcardData
        );

        console.log(result, 'Word Cloud Loader Page');

        navigate(ROUTES.WORD_CLOUD.substring(1));
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

import { useEffect, useRef, useState } from 'react';
import FileCard from '../../components/Coding/Shared/file_card';
import NavigationBottomBar from '../../components/Coding/Shared/navigation_bottom_bar';
import { LOADER_ROUTES, ROUTES } from '../../constants/Coding/shared';
import { useNavigate } from 'react-router-dom';
import { useLogger } from '../../context/logging_context';
import { MODEL_LIST, REMOTE_SERVER_ROUTES } from '../../constants/Shared';
import { createTimer } from '../../utility/timer';
import { useCodingContext } from '../../context/coding_context';
import { useCollectionContext } from '../../context/collection_context';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import getServerUtils from '../../hooks/Shared/get_server_url';

const fs = window.require('fs');
const { ipcRenderer } = window.require('electron');

const validExtensions = ['.pdf', '.doc', '.docx', '.txt'];

const ContextPage = () => {
    const navigate = useNavigate();
    const logger = useLogger();

    const {
        contextFiles,
        addContextFile,
        mainCode,
        additionalInfo,
        setAdditionalInfo,
        setMainCode,
        removeContextFile,
        setKeywords,
        researchQuestions,
        setResearchQuestions
    } = useCodingContext();

    const { datasetId } = useCollectionContext();

    const { saveWorkspaceData } = useWorkspaceUtils();
    const { getServerUrl } = getServerUtils();

    const [newQuestion, setNewQuestion] = useState<string>('');

    const addQuestion = () => {
        if (newQuestion.trim() !== '') {
            setResearchQuestions([...researchQuestions, newQuestion]);
            setNewQuestion('');
        }
    };

    const updateQuestion = (index: number, updatedQuestion: string) => {
        const updatedQuestions = researchQuestions.map((question, i) =>
            i === index ? updatedQuestion : question
        );
        setResearchQuestions(updatedQuestions);
    };

    const deleteQuestion = (index: number) => {
        const updatedQuestions = researchQuestions.filter((_, i) => i !== index);
        setResearchQuestions(updatedQuestions);
    };

    // Adjust the height of the text area based on its content
    const adjustHeight = (element: any) => {
        if (element) {
            element.style.height = 'auto'; // Reset to auto to measure new height
            element.style.height = `${Math.min(element.scrollHeight, 160)}px`; // Cap at 160px
        }
    };

    useEffect(() => {
        // Automatically adjust height for all existing questions on initial render
        document
            .querySelectorAll('textarea.auto-height')
            .forEach((textarea) => adjustHeight(textarea));
    }, [researchQuestions]);

    const hasSavedRef = useRef(false);

    const checkIfReady = Object.keys(contextFiles).length > 0 && mainCode.length > 0;

    useEffect(() => {
        const timer = createTimer();
        logger.info('Loaded Context Page');

        return () => {
            if (!hasSavedRef.current) {
                saveWorkspaceData();
                hasSavedRef.current = true;
            }
            logger.info('Unloaded Context Page').then(() => {
                logger.time('Context Page stay time', { time: timer.end() });
            });
        };
    }, []);

    const handleSelectFiles = async () => {
        const files: {
            filePath: string;
            fileName: string;
        }[] = await ipcRenderer.invoke('select-files'); // Access through preload
        if (!files || files.length === 0) return;

        // Filter files based on allowed extensions
        const filteredFiles = files.filter(({ fileName }) =>
            validExtensions.some((ext) => fileName.toLowerCase().endsWith(ext))
        );

        if (filteredFiles.length === 0) {
            alert('No valid files selected. Please select files with valid extensions.');
            return;
        }

        // Pass the selected files to the parent or context
        filteredFiles.forEach(({ filePath, fileName }) => {
            addContextFile(filePath, fileName);
        });
    };

    const handleOnNextClick = async (e: any) => {
        e.preventDefault();
        await logger.info('Starting Theme Cloud Generation');
        navigate('../loader/' + LOADER_ROUTES.THEME_LOADER);

        console.log('Sending request to server');
        // if (!USE_LOCAL_SERVER) {
        console.log('Sending request to remote server');
        const formData = new FormData();
        Object.keys(contextFiles).forEach((filePath) => {
            const fileContent = fs.readFileSync(filePath);
            const blob = new Blob([fileContent]);
            formData.append('contextFiles', blob, contextFiles[filePath]);
        });
        formData.append('model', MODEL_LIST.LLAMA_3_2);
        formData.append('mainCode', mainCode);
        formData.append('additionalInfo', additionalInfo ?? '');
        formData.append('retry', 'false');
        formData.append('dataset_id', datasetId);

        // await ipcRenderer.invoke("connect-ws", datasetId);
        let res = await fetch(getServerUrl(REMOTE_SERVER_ROUTES.ADD_DOCUMENTS_AND_GET_THEMES), {
            method: 'POST',
            body: formData
        });
        let results: {
            message: string;
            themes: string[];
        } = await res.json();
        console.log('Response from remote server', results);

        if (results.themes.length > 0) {
            setKeywords(Array.from(new Set(results.themes)));
        }

        // await ipcRenderer.invoke("disconnect-ws", datasetId);
        await logger.info('Theme Cloud generated');
        //     return;
        // }

        console.log('Ending function');
    };

    return (
        <div className="w-full h-full flex justify-between flex-col">
            <div className="h-[calc(100vh-11rem)]">
                <section>
                    {Object.keys(contextFiles).length === 0 ? (
                        <>
                            <h1>Select context files</h1>
                            <button
                                onClick={handleSelectFiles}
                                className="p-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                                Select Files
                            </button>
                        </>
                    ) : (
                        <>
                            <h1>Selected Context files</h1>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 py-10">
                                {Object.keys(contextFiles).map((filePath, index) => (
                                    <FileCard
                                        key={index}
                                        filePath={filePath}
                                        fileName={contextFiles[filePath]}
                                        onRemove={removeContextFile}
                                    />
                                ))}
                                <label
                                    className="flex items-center justify-center h-32 w-32 border rounded shadow-lg bg-white p-4 cursor-pointer text-blue-500 font-semibold hover:bg-blue-50"
                                    onClick={handleSelectFiles}>
                                    <span>+ Add File</span>
                                    {/* <button
                                        onClick={handleSelectFiles}
                                        className="p-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                                        Select Files
                                    </button> */}
                                </label>
                            </div>
                        </>
                    )}
                </section>
                <div>
                    <p>Main topic of interest:</p>
                    <input
                        type="text"
                        className="p-2 border border-gray-300 rounded w-96"
                        value={mainCode}
                        onChange={(e) => setMainCode(e.target.value)}
                    />
                </div>
                <div>
                    <p>Provide some additional information about your topic of interest:</p>
                    <textarea
                        className="p-2 border border-gray-300 rounded w-96"
                        value={additionalInfo}
                        onChange={(e) => setAdditionalInfo(e.target.value)}
                    />
                </div>
                <div>
                    <p>Research Questions:</p>
                    <div className="flex items-center">
                        <textarea
                            className="p-2 border border-gray-300 rounded w-72 max-h-40 resize-none overflow-auto auto-height"
                            placeholder="Type your research question here..."
                            value={newQuestion}
                            onChange={(e) => setNewQuestion(e.target.value)}
                        />
                        <button
                            onClick={addQuestion}
                            className="ml-2 p-2 bg-blue-500 text-white rounded">
                            Add
                        </button>
                    </div>
                    <ul className="mt-4">
                        {researchQuestions.map((question, index) => (
                            <li key={index} className="flex items-start mb-4">
                                <textarea
                                    className="p-2 border border-gray-300 rounded w-72 max-h-40 resize-none overflow-auto auto-height"
                                    value={question}
                                    onChange={(e) => updateQuestion(index, e.target.value)}
                                />
                                <button
                                    onClick={() => deleteQuestion(index)}
                                    className="ml-2 p-2 bg-red-500 text-white rounded">
                                    Delete
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
            <NavigationBottomBar
                previousPage={ROUTES.HOME}
                nextPage={ROUTES.KEYWORD_CLOUD}
                isReady={checkIfReady}
                onNextClick={handleOnNextClick}
            />
        </div>
    );
};

export default ContextPage;

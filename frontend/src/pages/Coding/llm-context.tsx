import { useEffect, useRef, useState } from 'react';
import FileCard from '../../components/Coding/Shared/file-card';
import NavigationBottomBar from '../../components/Coding/Shared/navigation-bottom-bar';
import { LOADER_ROUTES, PAGE_ROUTES, ROUTES } from '../../constants/Coding/shared';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLogger } from '../../context/logging-context';
import { REMOTE_SERVER_ROUTES, ROUTES as SHARED_ROUTES } from '../../constants/Shared';
import { createTimer } from '../../utility/timer';
import { useCodingContext } from '../../context/coding-context';
import { useCollectionContext } from '../../context/collection-context';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import getServerUtils from '../../hooks/Shared/get-server-url';
import { getCodingLoaderUrl } from '../../utility/get-loader-url';
import { useLoadingContext } from '../../context/loading-context';
import { TutorialStep } from '../../components/Shared/custom-tutorial-overlay';
import TutorialWrapper from '../../components/Shared/tutorial-wrapper';
import { useApi } from '../../hooks/Shared/use-api';
import { useSettings } from '../../context/settings-context';
import { toast } from 'react-toastify';
import { debounce } from 'lodash';

const fs = window.require('fs');
const { ipcRenderer } = window.require('electron');

const validExtensions = ['.pdf', '.doc', '.docx', '.txt'];

const ContextPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const logger = useLogger();
    const {
        contextFiles,
        addContextFile,
        mainTopic: globalMainTopic,
        additionalInfo: globalAdditionalInfo,
        setAdditionalInfo,
        setMainTopic,
        removeContextFile,
        setKeywords,
        researchQuestions: globalResearchQuestions,
        setResearchQuestions,
        dispatchKeywordsTable
    } = useCodingContext();
    const { settings } = useSettings();
    const { loadingState, loadingDispatch } = useLoadingContext();
    const { datasetId } = useCollectionContext();
    const { saveWorkspaceData } = useWorkspaceUtils();
    const { getServerUrl } = getServerUtils();
    const { fetchLLMData } = useApi();

    // Local state for fields prone to frequent changes
    const [localMainTopic, setLocalMainTopic] = useState(globalMainTopic);
    const [localAdditionalInfo, setLocalAdditionalInfo] = useState(globalAdditionalInfo);
    const [localResearchQuestions, setLocalResearchQuestions] = useState(globalResearchQuestions);
    const [newQuestion, setNewQuestion] = useState<string>('');

    // Debounced update functions using useRef to persist across renders
    const debouncedSetMainTopic = useRef(debounce((value) => setMainTopic(value), 500)).current;
    const debouncedSetAdditionalInfo = useRef(
        debounce((value) => setAdditionalInfo(value), 500)
    ).current;
    const debouncedSetResearchQuestions = useRef(
        debounce((value) => setResearchQuestions(value), 500)
    ).current;

    // Sync local state with global state on mount or when global state changes
    useEffect(() => {
        setLocalMainTopic(globalMainTopic);
    }, [globalMainTopic]);

    useEffect(() => {
        setLocalAdditionalInfo(globalAdditionalInfo);
    }, [globalAdditionalInfo]);

    useEffect(() => {
        setLocalResearchQuestions(globalResearchQuestions);
    }, [globalResearchQuestions]);

    const steps: TutorialStep[] = [
        { target: '#file-section', content: 'Click "+ Add File" to add a file.' },
        {
            target: '#topic-section',
            content: 'Enter your main topic of interest and related additional information.'
        },
        { target: '#research-section', content: 'Add relevant research questions.' },
        { target: '#proceed-next-step', content: 'Proceed to next step', placement: 'top left' }
    ];

    // Handlers for updating local state and triggering debounced global updates
    const handleMainTopicChange = (value: string) => {
        setLocalMainTopic(value);
        debouncedSetMainTopic(value);
    };

    const handleAdditionalInfoChange = (value: string) => {
        setLocalAdditionalInfo(value);
        debouncedSetAdditionalInfo(value);
    };

    const addQuestion = () => {
        if (newQuestion.trim() !== '') {
            const updatedQuestions = [...localResearchQuestions, newQuestion];
            setLocalResearchQuestions(updatedQuestions);
            debouncedSetResearchQuestions(updatedQuestions);
            setNewQuestion('');
        }
    };

    const updateQuestion = (index: number, updatedQuestion: string) => {
        const updatedQuestions = localResearchQuestions.map((question, i) =>
            i === index ? updatedQuestion : question
        );
        setLocalResearchQuestions(updatedQuestions);
        debouncedSetResearchQuestions(updatedQuestions);
    };

    const deleteQuestion = (index: number) => {
        const updatedQuestions = localResearchQuestions.filter((_, i) => i !== index);
        setLocalResearchQuestions(updatedQuestions);
        debouncedSetResearchQuestions(updatedQuestions);
    };

    const adjustHeight = (element: any) => {
        if (element) {
            element.style.height = 'auto';
            element.style.height = `${Math.min(element.scrollHeight, 160)}px`;
        }
    };

    useEffect(() => {
        document
            .querySelectorAll('textarea.auto-height')
            .forEach((textarea) => adjustHeight(textarea));
    }, [localResearchQuestions]);

    const checkIfReady = Object.keys(contextFiles).length > 0 && localMainTopic.length > 0;

    const hasSavedRef = useRef(false);
    useEffect(() => {
        const timer = createTimer();
        logger.info('Loaded Context Page');

        return () => {
            console.log('Unloading Context Page');
            if (!hasSavedRef.current) {
                console.log('Saving workspace data on unload of Context Page');
                hasSavedRef.current = true;
                saveWorkspaceData().finally(() => {
                    hasSavedRef.current = false;
                });
            }
            logger.info('Unloaded Context Page').then(() => {
                logger.time('Context Page stay time', { time: timer.end() });
            });
        };
    }, []);

    const handleSelectFiles = async () => {
        const files: { filePath: string; fileName: string }[] =
            await ipcRenderer.invoke('select-files');
        if (!files || files.length === 0) return;

        const filteredFiles = files.filter(({ fileName }) =>
            validExtensions.some((ext) => fileName.toLowerCase().endsWith(ext))
        );

        if (filteredFiles.length === 0) {
            alert('No valid files selected. Please select files with valid extensions.');
            return;
        }

        filteredFiles.forEach(({ filePath, fileName }) => {
            addContextFile(filePath, fileName);
        });
    };

    const handleOnNextClick = async (e: any) => {
        if (!datasetId) return;
        if (newQuestion.trim() !== '') {
            alert(
                "You have an unsaved research question. Please click 'Add' to include it or clear the text before proceeding."
            );
            throw new Error('Unsaved research question');
        }
        e.preventDefault();
        loadingDispatch({ type: 'SET_LOADING_ROUTE', route: PAGE_ROUTES.KEYWORD_CLOUD });
        await logger.info('Starting Theme Cloud Generation');
        navigate(getCodingLoaderUrl(LOADER_ROUTES.THEME_LOADER));

        const formData = new FormData();
        Object.keys(contextFiles).forEach((filePath) => {
            const fileContent = fs.readFileSync(filePath);
            const blob = new Blob([fileContent]);
            formData.append('contextFiles', blob, contextFiles[filePath]);
        });
        formData.append('model', settings.ai.model);

        const { data: results, error } = await fetchLLMData<{
            message: string;
        }>(REMOTE_SERVER_ROUTES.BUILD_CONTEXT, { method: 'POST', body: formData });

        if (error) {
            console.error('Error building context:', error);
            if (error.name !== 'AbortError') {
                toast.error('Error building context. Please try again. ' + (error.message ?? ''));
                navigate(PAGE_ROUTES.CONTEXT_V2);
                loadingDispatch({
                    type: 'SET_LOADING_DONE_ROUTE',
                    route: PAGE_ROUTES.KEYWORD_CLOUD
                });
                throw new Error(error.message);
            }
            return;
        }
        console.log('Response from remote server', results);

        await logger.info('Theme Cloud generated');
        loadingDispatch({ type: 'SET_LOADING_DONE_ROUTE', route: PAGE_ROUTES.KEYWORD_CLOUD });
        navigate(PAGE_ROUTES.KEYWORD_CLOUD);
    };

    return (
        <>
            <TutorialWrapper
                steps={steps}
                promptOnFirstPage
                pageId={location.pathname}
                excludedTarget={`#route-/${SHARED_ROUTES.CODING}/${ROUTES.BACKGROUND_RESEARCH}`}>
                <div className="w-full h-full flex justify-between flex-col relative">
                    <div className="max-h-maxPageContent h-maxPageContent">
                        <section id="file-section" className="max-h-3/5 h-3/5 border-b-2">
                            <h1 className="text-center">
                                Provide context for DeTAILS by uploading literature (e.g., research
                                papers), formulating research questions, identifying topics of
                                interest, and including additional information related to your
                                topic-
                            </h1>
                            <div className="flex flex-wrap gap-4 py-6 lg:py-10 justify-center items-center h-4/5 flex-1 overflow-auto">
                                <label
                                    className="flex items-center justify-center h-48 w-36 border rounded shadow-lg bg-white p-4 cursor-pointer text-blue-500 font-semibold hover:bg-blue-50"
                                    onClick={handleSelectFiles}>
                                    <span>+ Add File</span>
                                </label>
                                {Object.keys(contextFiles).map((filePath) => (
                                    <FileCard
                                        key={filePath}
                                        filePath={filePath}
                                        fileName={contextFiles[filePath]}
                                        onRemove={removeContextFile}
                                    />
                                ))}
                            </div>
                        </section>
                        <div className="flex justify-start items-center max-h-2/5 h-2/5 overflow-hidden">
                            <section id="topic-section" className="w-1/2">
                                <div>
                                    <p>Main topic of interest:</p>
                                    <input
                                        type="text"
                                        maxLength={32}
                                        placeholder="Max 32 characters"
                                        className="p-2 border border-gray-300 rounded w-96"
                                        value={localMainTopic}
                                        onChange={(e) => handleMainTopicChange(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <p>
                                        Provide any additional information about your topic of
                                        interest:
                                    </p>
                                    <textarea
                                        className="p-2 border border-gray-300 rounded w-96 resize-none"
                                        value={localAdditionalInfo}
                                        onChange={(e) => handleAdditionalInfoChange(e.target.value)}
                                    />
                                </div>
                            </section>
                            <section
                                id="research-section"
                                className="w-1/2 max-h-full flex flex-col justify-center items-center overflow-y-auto">
                                <div className="overflow-auto">
                                    <p>Research Questions:</p>
                                    <div className="flex items-center">
                                        <textarea
                                            className="p-2 border border-gray-300 rounded w-72 max-h-40 resize-none"
                                            placeholder="Type your research question here..."
                                            value={newQuestion}
                                            onChange={(e) => setNewQuestion(e.target.value)}
                                        />
                                        {newQuestion.trim() !== '' && (
                                            <button
                                                onClick={addQuestion}
                                                className="ml-2 p-2 bg-blue-500 text-white rounded">
                                                Add
                                            </button>
                                        )}
                                    </div>
                                    <ul className="mt-4">
                                        {localResearchQuestions.map((question, index) => (
                                            <li key={index} className="flex items-start mb-4">
                                                <textarea
                                                    className="p-2 border border-gray-300 rounded w-72 max-h-40 resize-none auto-height"
                                                    value={question}
                                                    onChange={(e) =>
                                                        updateQuestion(index, e.target.value)
                                                    }
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
                            </section>
                        </div>
                    </div>
                    <NavigationBottomBar
                        previousPage={PAGE_ROUTES.HOME}
                        nextPage={PAGE_ROUTES.KEYWORD_CLOUD}
                        isReady={checkIfReady}
                        onNextClick={handleOnNextClick}
                        autoNavigateToNext={false}
                        disabledTooltipText="Files or main topic is missing"
                    />
                </div>
            </TutorialWrapper>
        </>
    );
};

export default ContextPage;

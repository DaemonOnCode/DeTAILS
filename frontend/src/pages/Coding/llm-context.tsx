import { useEffect, useRef, useState } from 'react';
import FileCard from '../../components/Coding/Shared/file-card';
import NavigationBottomBar from '../../components/Coding/Shared/navigation-bottom-bar';
import { LOADER_ROUTES, PAGE_ROUTES, ROUTES } from '../../constants/Coding/shared';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLogger } from '../../context/logging-context';
import { REMOTE_SERVER_ROUTES, ROUTES as SHARED_ROUTES } from '../../constants/Shared';
import { createTimer } from '../../utility/timer';
import { useCodingContext } from '../../context/coding-context';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import { TutorialStep } from '../../components/Shared/custom-tutorial-overlay';
import TutorialWrapper from '../../components/Shared/tutorial-wrapper';
import { useSettings } from '../../context/settings-context';
import { debounce } from 'lodash';
import { useNextHandler } from '../../hooks/Coding/use-handler-factory';
import { useLoadingContext } from '../../context/loading-context';
import { toast } from 'react-toastify';

const fs = window.require('fs');
const { ipcRenderer } = window.require('electron');

const validExtensions = ['.pdf', '.doc', '.docx', '.txt'];

const ContextPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const logger = useLogger();
    const {
        contextFiles,
        addContextFilesBatch,
        mainTopic: globalMainTopic,
        additionalInfo: globalAdditionalInfo,
        setAdditionalInfo,
        setMainTopic,
        removeContextFile,
        researchQuestions: globalResearchQuestions,
        setResearchQuestions
    } = useCodingContext();
    const { settings } = useSettings();
    const { saveWorkspaceData } = useWorkspaceUtils();
    const { loadingDispatch } = useLoadingContext();

    const [localMainTopic, setLocalMainTopic] = useState(globalMainTopic);
    const [localAdditionalInfo, setLocalAdditionalInfo] = useState(globalAdditionalInfo);
    const [localResearchQuestions, setLocalResearchQuestions] = useState(globalResearchQuestions);
    const [newQuestion, setNewQuestion] = useState<string>('');

    const debouncedSetMainTopic = useRef(debounce((value) => setMainTopic(value), 500)).current;
    const debouncedSetAdditionalInfo = useRef(
        debounce((value) => setAdditionalInfo(value), 500)
    ).current;
    const debouncedSetResearchQuestions = useRef(
        debounce((value) => setResearchQuestions(value), 500)
    ).current;

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

    const handleMainTopicChange = (value: string) => {
        setLocalMainTopic(value);
        debouncedSetMainTopic(value);
    };

    const handleAdditionalInfoChange = (value: string) => {
        setLocalAdditionalInfo(value);
        debouncedSetAdditionalInfo(value);
    };

    const addQuestion = () => {
        const questions = newQuestion
            .split(/(?:\s*\n\s*){2,}/)
            .map((q) => q.trim())
            .filter((q) => q);
        if (questions.length > 0) {
            const updatedQuestions = [...localResearchQuestions, ...questions];
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

    const checkIfReady = localMainTopic.length > 0;

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
        addContextFilesBatch(filteredFiles);
    };

    const handleOnNextClick = useNextHandler({
        startLog: 'Starting Related Concept Generation',
        doneLog: 'Related Concepts generated',
        loadingRoute: PAGE_ROUTES.RELATED_CONCEPTS,
        loaderRoute: LOADER_ROUTES.THEME_LOADER,
        remoteRoute: REMOTE_SERVER_ROUTES.BUILD_CONTEXT,
        useLLM: true,
        buildBody: () => {
            const formData = new FormData();
            Object.keys(contextFiles).forEach((filePath) => {
                const fileContent = fs.readFileSync(filePath);
                const blob = new Blob([fileContent]);
                formData.append('contextFiles', blob, contextFiles[filePath]);
            });
            formData.append('model', settings.ai.model);
            return formData;
        },
        onSuccess: (data) => {
            console.log('Response from remote server', data);
            navigate(PAGE_ROUTES.RELATED_CONCEPTS);
        },
        checkUnsaved: () => {
            if (newQuestion.trim() !== '') {
                alert(
                    "You have an unsaved research question. Please click 'Add' to include it or clear the text before proceeding."
                );
                throw new Error('Unsaved research question');
            }
        }
    });

    const handleOnNextClickWithoutFiles = async () => {
        console.log('No context files provided, proceeding to data type selection');
        if (newQuestion.trim() !== '') {
            alert(
                "You have an unsaved research question. Please click 'Add' to include it or clear the text before proceeding."
            );
            toast.error('Unsaved research question');
            return;
        }
        if (Object.keys(contextFiles).length > 0) return;

        navigate(PAGE_ROUTES.DATA_TYPE);
        loadingDispatch({
            type: 'SET_FIRST_RUN_DONE',
            route: PAGE_ROUTES.RELATED_CONCEPTS
        });
        loadingDispatch({
            type: 'SET_FIRST_RUN_DONE',
            route: PAGE_ROUTES.CONCEPT_OUTLINE
        });
        loadingDispatch({
            type: 'SET_LOADING_DONE_ROUTE',
            route: PAGE_ROUTES.DATA_TYPE
        });
    };

    return (
        <>
            <TutorialWrapper
                steps={steps}
                promptOnFirstPage
                pageId={location.pathname}
                excludedTarget={`#route-/${SHARED_ROUTES.CODING}/${ROUTES.BACKGROUND_RESEARCH} `}>
                <div className="w-full h-full flex justify-between flex-col relative">
                    <div className="max-h-maxPageContent h-maxPageContent">
                        <section id="file-section" className="max-h-3/5 h-3/5 border-b-2">
                            <h1 className="text-center">
                                Provide context for DeTAILS by uploading literature (e.g., research
                                papers), formulating research questions, identifying topics of
                                interest, and including additional information related to your
                                topic. Note: If you upload research literature (PDFs), then you will
                                be taken to analyze Reddit data. If you don't upload research
                                literature but instead only research questions, etc., then you can
                                analyze interviews-
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
                                            className="p-2 border border-gray-300 rounded w-96 max-h-40 resize-none"
                                            placeholder="Enter research questions, separate multiple questions with blank lines"
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
                                                    className="p-2 border border-gray-300 rounded w-96 max-h-40 resize-none auto-height"
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
                        nextPage={
                            Object.keys(contextFiles).length > 0
                                ? PAGE_ROUTES.RELATED_CONCEPTS
                                : PAGE_ROUTES.DATA_TYPE
                        }
                        isReady={checkIfReady}
                        onNextClick={
                            Object.keys(contextFiles).length > 0
                                ? handleOnNextClick
                                : handleOnNextClickWithoutFiles
                        }
                        autoNavigateToNext={false}
                        disabledTooltipText="Files or main topic is missing"
                    />
                </div>
            </TutorialWrapper>
        </>
    );
};

export default ContextPage;

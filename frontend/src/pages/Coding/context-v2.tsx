import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import FileCard from '../../components/Coding/Shared/file-card';
import NavigationBottomBar from '../../components/Coding/Shared/navigation-bottom-bar';
import { LOADER_ROUTES, ROUTES } from '../../constants/Coding/shared';
import { ROUTES as SHARED_ROUTES } from '../../constants/Shared';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLogger } from '../../context/logging-context';
import { MODEL_LIST, REMOTE_SERVER_ROUTES } from '../../constants/Shared';
import { createTimer } from '../../utility/timer';
import { useCodingContext } from '../../context/coding-context';
import { useCollectionContext } from '../../context/collection-context';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import getServerUtils from '../../hooks/Shared/get-server-url';
import { getCodingLoaderUrl } from '../../utility/get-loader-url';
import { useLoadingContext } from '../../context/loading-context';
import { TutorialStep } from '../../components/Shared/custom-tutorial-overlay';
import TutorialWrapper from '../../components/Shared/tutorial-wrapper';
import { StepHandle } from '../../types/Shared';
import { useApi } from '../../hooks/Shared/use-api';
import { useSettings } from '../../context/settings-context';

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
        mainTopic,
        additionalInfo,
        setAdditionalInfo,
        setMainTopic,
        removeContextFile,
        setKeywords,
        researchQuestions,
        setResearchQuestions,
        dispatchKeywordsTable
    } = useCodingContext();
    const { settings } = useSettings();
    const { loadingState, loadingDispatch, registerStepRef } = useLoadingContext();
    const { datasetId } = useCollectionContext();
    const { saveWorkspaceData } = useWorkspaceUtils();
    const { getServerUrl } = getServerUtils();
    const { fetchData } = useApi();
    const [newQuestion, setNewQuestion] = useState<string>('');

    const steps: TutorialStep[] = [
        {
            target: '#file-section',
            content: 'Click "+ Add File" to add a file.'
        },
        {
            target: '#topic-section',
            content: 'Enter your main topic of interest and related additional information.'
        },
        {
            target: '#research-section',
            content: 'Add relevant research questions.'
        },
        {
            target: '#proceed-next-step',
            content: 'Proceed to next step',
            placement: 'top left'
        }
    ];

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
    }, [researchQuestions]);

    const checkIfReady = Object.keys(contextFiles).length > 0 && mainTopic.length > 0;

    useEffect(() => {
        const timer = createTimer();
        logger.info('Loaded Context Page');

        return () => {
            saveWorkspaceData();
            logger.info('Unloaded Context Page').then(() => {
                logger.time('Context Page stay time', { time: timer.end() });
            });
        };
    }, []);

    // useEffect(() => {
    //     if (loadingState[ROUTES.LLM_CONTEXT_V2]) {
    //         navigate(getCodingLoaderUrl(LOADER_ROUTES.THEME_LOADER));
    //     }
    // }, [loadingState]);

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
            return;
        }
        e.preventDefault();
        loadingDispatch({
            type: 'SET_LOADING_ROUTE',
            route: `/${SHARED_ROUTES.CODING}/${ROUTES.BACKGROUND_RESEARCH}/${ROUTES.KEYWORD_CLOUD}`
        });
        await logger.info('Starting Theme Cloud Generation');
        navigate(getCodingLoaderUrl(LOADER_ROUTES.THEME_LOADER));

        const formData = new FormData();
        Object.keys(contextFiles).forEach((filePath) => {
            const fileContent = fs.readFileSync(filePath);
            const blob = new Blob([fileContent]);
            formData.append('contextFiles', blob, contextFiles[filePath]);
        });
        formData.append('model', settings.ai.model);
        formData.append('mainTopic', mainTopic);
        formData.append('additionalInfo', additionalInfo ?? '');
        formData.append('retry', 'false');
        formData.append('researchQuestions', JSON.stringify(researchQuestions));
        formData.append('datasetId', datasetId);

        const { data: results, error } = await fetchData<{
            message: string;
            keywords: {
                word: string;
                description: string;
                inclusion_criteria: string[];
                exclusion_criteria: string[];
            }[];
        }>(REMOTE_SERVER_ROUTES.BUILD_CONTEXT, {
            method: 'POST',
            body: formData
        });

        if (error) {
            console.error('Error building context:', error);
            loadingDispatch({
                type: 'SET_LOADING_DONE_ROUTE',
                route: `/${SHARED_ROUTES.CODING}/${ROUTES.BACKGROUND_RESEARCH}/${ROUTES.KEYWORD_CLOUD}`
            });
            return;
        }
        console.log('Response from remote server', results);

        if (results.keywords.length > 0) {
            setKeywords(Array.from(new Set(results.keywords.map((keyword) => keyword.word))));
        }
        dispatchKeywordsTable({
            type: 'INITIALIZE',
            entries: results.keywords.map((r) => ({ ...r, isMarked: true }))
        });
        await logger.info('Theme Cloud generated');
        loadingDispatch({
            type: 'SET_LOADING_DONE_ROUTE',
            route: `/${SHARED_ROUTES.CODING}/${ROUTES.BACKGROUND_RESEARCH}/${ROUTES.KEYWORD_CLOUD}`
        });
        navigate(`/${SHARED_ROUTES.CODING}/${ROUTES.BACKGROUND_RESEARCH}/${ROUTES.KEYWORD_CLOUD}`);
    };

    // useEffect(() => {
    //     const stepRoute = location.pathname;
    //     registerStepRef(stepRoute, internalRef);
    // }, []);

    // Expose the imperative methods for this step via the forwarded ref.
    // useImperativeHandle(loadingState[location.pathname].stepRef, () => ({
    //     validateStep: () => {
    //         if (Object.keys(contextFiles).length === 0) {
    //             alert('Please add at least one context file.');
    //             return false;
    //         }
    //         if (mainTopic.trim() === '') {
    //             alert('Main topic is required.');
    //             return false;
    //         }
    //         return true;
    //     },
    //     resetStep: () => {
    //         // Reset context files
    //         Object.keys(contextFiles).forEach((filePath) => {
    //             removeContextFile(filePath);
    //         });
    //         // Reset main topic, additional info, and research questions
    //         setMainTopic('');
    //         setAdditionalInfo('');
    //         setResearchQuestions([]);
    //     }
    // }));

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
                            <h1>
                                Provide context for DeTAILS by uploading literature (e.g., research
                                papers), formulating research questions, identifying topics of
                                interest, and including additiona information related to your topic-
                            </h1>
                            <div className="flex flex-wrap gap-4 py-6 lg:py-10 justify-center items-center h-4/5 flex-1 overflow-auto max-w-screen-sm lg:max-w-screen-lg">
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
                                        className="p-2 border border-gray-300 rounded w-96"
                                        value={mainTopic}
                                        onChange={(e) => setMainTopic(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <p>
                                        Provide any additional information about your topic of
                                        interest:
                                    </p>
                                    <textarea
                                        className="p-2 border border-gray-300 rounded w-96"
                                        value={additionalInfo}
                                        onChange={(e) => setAdditionalInfo(e.target.value)}
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
                                            className="p-2 border border-gray-300 rounded w-72 max-h-40 resize-none overflow-auto auto-height"
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
                                        {researchQuestions.map((question, index) => (
                                            <li key={index} className="flex items-start mb-4">
                                                <textarea
                                                    className="p-2 border border-gray-300 rounded w-72 max-h-40 resize-none overflow-auto auto-height"
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
                        previousPage={ROUTES.HOME}
                        nextPage={`${ROUTES.BACKGROUND_RESEARCH}/${ROUTES.KEYWORD_CLOUD}`}
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

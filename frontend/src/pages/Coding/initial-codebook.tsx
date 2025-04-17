import { useRef, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import NavigationBottomBar from '../../components/Coding/Shared/navigation-bottom-bar';
import { LOADER_ROUTES, PAGE_ROUTES, ROUTES } from '../../constants/Coding/shared';
import { REMOTE_SERVER_ROUTES, ROUTES as SHARED_ROUTES } from '../../constants/Shared';
import { useCodingContext } from '../../context/coding-context';
import { useCollectionContext } from '../../context/collection-context';
import { useLoadingContext } from '../../context/loading-context';
import { useLogger } from '../../context/logging-context';
import { useWorkspaceContext } from '../../context/workspace-context';
import useServerUtils from '../../hooks/Shared/get-server-url';
import { useApi } from '../../hooks/Shared/use-api';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import { getCodingLoaderUrl } from '../../utility/get-loader-url';
import { createTimer } from '../../utility/timer';
import { useSettings } from '../../context/settings-context';
import { TutorialStep } from '../../components/Shared/custom-tutorial-overlay';
import TutorialWrapper from '../../components/Shared/tutorial-wrapper';
import { useUndo } from '../../hooks/Shared/use-undo';
import useScrollRestoration from '../../hooks/Shared/use-scroll-restoration';
import VirtualizedTableRow from '../../components/Coding/InitialCodebook/virtualized-table-row';
import { DetailsLLMIcon } from '../../components/Shared/Icons';

const InitialCodeBook = () => {
    const {
        initialCodebookTable,
        dispatchInitialCodebookTable,
        sampledPostResponse,
        unseenPostIds,
        researchQuestions,
        mainTopic,
        additionalInfo,
        keywordTable,
        dispatchUnseenPostResponse
    } = useCodingContext();

    const location = useLocation();
    const { performWithUndoForReducer } = useUndo();

    const logger = useLogger();
    const { currentWorkspace } = useWorkspaceContext();
    const { saveWorkspaceData } = useWorkspaceUtils();
    const navigate = useNavigate();
    const { getServerUrl } = useServerUtils();
    const { datasetId } = useCollectionContext();
    const { fetchLLMData } = useApi();
    const { settings } = useSettings();

    const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
    const [feedback, setFeedback] = useState('');

    const { loadingState, loadingDispatch, checkIfDataExists, resetDataAfterPage, openModal } =
        useLoadingContext();
    const hasSavedRef = useRef(false);
    useEffect(() => {
        const timer = createTimer();
        logger.info('Code Creation Page Loaded');

        return () => {
            if (!hasSavedRef.current) {
                hasSavedRef.current = true;
                saveWorkspaceData().finally(() => {
                    hasSavedRef.current = false;
                });
            }
            logger.info('Code Creation Page Unloaded').then(() => {
                logger.time('Code Creation Page stay time', { time: timer.end() });
            });
        };
    }, []);

    const stepRoute = location.pathname;

    const { scrollRef: tableRef, storageKey } = useScrollRestoration('initial-codebook-table');

    const handleDefinitionChange = (index: number, newDefinition: string) => {
        const action = {
            type: 'UPDATE_FIELD',
            index,
            field: 'definition',
            value: newDefinition
        };
        performWithUndoForReducer(initialCodebookTable, dispatchInitialCodebookTable, action);
    };

    const handleNextClick = async () => {
        navigate(
            getCodingLoaderUrl(LOADER_ROUTES.FINAL_CODING_LOADER, {
                text: 'Final Coding in Progress'
            })
        );

        loadingDispatch({
            type: 'SET_LOADING_ROUTE',
            route: PAGE_ROUTES.FINAL_CODING
        });

        const { data: results, error } = await fetchLLMData<{
            message: string;
            data: {
                id: string;
                postId: string;
                quote: string;
                explanation: string;
                code: string;
            }[];
        }>(REMOTE_SERVER_ROUTES.FINAL_CODING, {
            method: 'POST',
            body: JSON.stringify({
                model: settings.ai.model
            })
        });

        if (error) {
            console.error('Error in handleNextClick:', error);
            if (error.name !== 'AbortError') {
                toast.error(
                    'Error generating codebook. Please try again. ' + (error.message ?? '')
                );
                navigate(PAGE_ROUTES.INITIAL_CODEBOOK);
                loadingDispatch({
                    type: 'SET_LOADING_DONE_ROUTE',
                    route: PAGE_ROUTES.FINAL_CODING
                });
                throw new Error(error.message);
            }
            return;
        }

        console.log('Results:', results);

        loadingDispatch({
            type: 'SET_LOADING_DONE_ROUTE',
            route: PAGE_ROUTES.FINAL_CODING
        });
    };

    const handleRegenerateCodebook = async (extraFeedback = '') => {
        navigate(getCodingLoaderUrl(LOADER_ROUTES.CODEBOOK_LOADER));
        loadingDispatch({ type: 'SET_LOADING_ROUTE', route: PAGE_ROUTES.INITIAL_CODEBOOK });

        const { data: results, error } = await fetchLLMData<{
            message: string;
            data: { [code: string]: string };
        }>(REMOTE_SERVER_ROUTES.REGENERATE_CODEBOOK_WITHOUT_QUOTES, {
            method: 'POST',
            body: JSON.stringify({
                model: settings.ai.model,
                feedback: extraFeedback
            })
        });

        if (error) {
            console.error('Error in handleRegenerateCodebook:', error);
            if (error.name !== 'AbortError') {
                toast.error('Error generating codebook. Please try again. ' + error.message);
                navigate(PAGE_ROUTES.INITIAL_CODEBOOK);
                loadingDispatch({
                    type: 'SET_LOADING_DONE_ROUTE',
                    route: PAGE_ROUTES.INITIAL_CODEBOOK
                });
                throw new Error(error.message);
            }
            return;
        }

        console.log('Results:', results);

        loadingDispatch({ type: 'SET_LOADING_DONE_ROUTE', route: PAGE_ROUTES.INITIAL_CODEBOOK });
        navigate(PAGE_ROUTES.INITIAL_CODEBOOK);
    };

    const handleFeedbackSubmit = async () => {
        setIsFeedbackModalOpen(false);
        if (await checkIfDataExists(location.pathname)) {
            openModal('refresh-codebook-submitted', async () => {
                await resetDataAfterPage(location.pathname);
                await handleRegenerateCodebook(feedback);
            });
        } else {
            loadingDispatch({ type: 'SET_REST_UNDONE', route: location.pathname });
            handleRegenerateCodebook(feedback);
        }
        setFeedback('');
    };

    const steps: TutorialStep[] = [
        {
            target: '#initial-codebook-table',
            content:
                'This is your Initial Codebook table. You can edit the definitions as you wish.',
            placement: 'bottom'
        },
        {
            target: '#initial-code-0',
            content: 'These are your codes. These are the codes from Initial Coding.',
            placement: 'right'
        },
        {
            target: '#initial-definition-0',
            content:
                'These are your definitions. These are the definitions based on the codes generated and their respective explanations. This field is editable.',
            placement: 'left'
        },
        {
            target: '#proceed-next-step',
            content: 'Proceed to next step',
            placement: 'top'
        }
    ];

    useEffect(() => {
        if (loadingState[stepRoute]?.isLoading) {
            navigate(
                getCodingLoaderUrl(LOADER_ROUTES.DATA_LOADING_LOADER, {
                    text: 'Generating Initial Codebook'
                })
            );
        }
    }, []);

    if (loadingState[stepRoute]?.isFirstRun) {
        return (
            <p className="h-page w-full flex justify-center items-center">
                Please complete the previous page and click on proceed to continue with this page.
            </p>
        );
    }

    return (
        <TutorialWrapper
            steps={steps}
            pageId={location.pathname}
            excludedTarget={`#route-/${SHARED_ROUTES.CODING}/${ROUTES.INITIAL_CODING_CODEBOOK}`}>
            <div className="h-page flex flex-col">
                {/* Header */}
                <header className="flex-none py-4">
                    <h1>Initial Codebook</h1>
                </header>

                {/* Main content with scrollable table */}
                <main className="flex-1 overflow-hidden flex flex-col">
                    <div className="flex-1 overflow-auto" ref={tableRef}>
                        <table
                            className="w-full border-separate border-spacing-0"
                            id="initial-codebook-table">
                            {/* Table Header */}
                            <thead className="sticky top-0">
                                <tr className="bg-gray-200">
                                    <th
                                        className="border border-gray-400 p-2 max-w-32"
                                        id="intial-code-heading">
                                        Code
                                    </th>
                                    <th
                                        className="border border-gray-400 p-2"
                                        id="intial-definition-heading">
                                        Definition
                                    </th>
                                </tr>
                            </thead>
                            {/* Table Body */}
                            <tbody>
                                {initialCodebookTable.map((entry, index) => (
                                    <VirtualizedTableRow
                                        key={index}
                                        entry={entry}
                                        index={index}
                                        onDefinitionChange={handleDefinitionChange}
                                        root={tableRef.current}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="pt-4 flex justify-end">
                        <button
                            id="refresh-codes-button"
                            onClick={() => {
                                // if (checkIfDataExists(location.pathname)) {
                                //     openModal('refresh-codes-submitted', async () => {
                                //         await resetDataAfterPage(location.pathname);
                                //         // await handleRefreshCodes();
                                //     });
                                // } else {
                                //     loadingDispatch({
                                //         type: 'SET_REST_UNDONE',
                                //         route: location.pathname
                                //     });
                                //     // handleRefreshCodes();
                                // }
                                setIsFeedbackModalOpen(true);
                            }}
                            className="px-4 py-2 bg-gray-600 text-white rounded flex justify-center items-center gap-2">
                            <DetailsLLMIcon className="h-6 w-6" />
                            Redo Codebook
                        </button>
                    </div>
                </main>

                <footer id="bottom-navigation" className="flex-none">
                    <NavigationBottomBar
                        previousPage={PAGE_ROUTES.INITIAL_CODING}
                        nextPage={PAGE_ROUTES.FINAL_CODING}
                        isReady={true}
                        onNextClick={handleNextClick}
                    />
                </footer>
                {isFeedbackModalOpen && (
                    <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50">
                        <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
                            <h2 className="text-xl font-bold mb-4">Provide Feedback (Optional)</h2>
                            <p className="mb-3">
                                Please share any feedback on the current codebook:
                            </p>
                            <textarea
                                value={feedback}
                                onChange={(e) => setFeedback(e.target.value)}
                                className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                rows={4}
                                placeholder="Enter your feedback here..."
                            />
                            <div className="flex justify-end mt-4">
                                <button
                                    onClick={() => setIsFeedbackModalOpen(false)}
                                    className="mr-4 bg-gray-300 px-4 py-2 rounded-md hover:bg-gray-400">
                                    Cancel
                                </button>
                                <button
                                    onClick={handleFeedbackSubmit}
                                    className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600">
                                    Submit
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </TutorialWrapper>
    );
};

export default InitialCodeBook;

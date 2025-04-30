import { useRef, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import NavigationBottomBar from '../../components/Coding/Shared/navigation-bottom-bar';
import { LOADER_ROUTES, PAGE_ROUTES, ROUTES } from '../../constants/Coding/shared';
import { REMOTE_SERVER_ROUTES, ROUTES as SHARED_ROUTES } from '../../constants/Shared';
import { useCodingContext } from '../../context/coding-context';
import { useLoadingContext } from '../../context/loading-context';
import { useLogger } from '../../context/logging-context';
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
import { useNextHandler, useRetryHandler } from '../../hooks/Coding/use-handler-factory';

const InitialCodeBook = () => {
    const { initialCodebookTable, dispatchInitialCodebookTable } = useCodingContext();

    const location = useLocation();
    const { performWithUndoForReducer } = useUndo();

    const logger = useLogger();
    const { saveWorkspaceData } = useWorkspaceUtils();
    const navigate = useNavigate();
    const { settings } = useSettings();

    const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
    const [feedback, setFeedback] = useState('');

    const { loadingState, loadingDispatch, checkIfDataExists, resetDataAfterPage, openModal } =
        useLoadingContext();
    const hasSavedRef = useRef(false);
    useEffect(() => {
        const timer = createTimer();
        logger.info('Initial Codebook Page Loaded');

        return () => {
            if (!hasSavedRef.current) {
                hasSavedRef.current = true;
                saveWorkspaceData().finally(() => {
                    hasSavedRef.current = false;
                });
            }
            logger.info('Initial Codebook Page Unloaded').then(() => {
                logger.time('Initial Codebook Page stay time', { time: timer.end() });
            });
        };
    }, []);

    const stepRoute = location.pathname;

    const { scrollRef: tableRef } = useScrollRestoration('initial-codebook-table');

    const handleDefinitionChange = (index: number, newDefinition: string) => {
        const action = {
            type: 'UPDATE_FIELD',
            index,
            field: 'definition',
            value: newDefinition
        };
        performWithUndoForReducer(
            initialCodebookTable,
            dispatchInitialCodebookTable,
            action,
            false
        );
    };

    const handleNextClick = useNextHandler({
        startLog: 'Starting final coding',
        doneLog: 'Final coding completed',
        loadingRoute: PAGE_ROUTES.FINAL_CODING,
        loaderRoute: LOADER_ROUTES.FINAL_CODING_LOADER,
        loaderParams: { text: 'Final Coding in Progress' },
        remoteRoute: REMOTE_SERVER_ROUTES.GENERATE_FINAL_CODES,
        useLLM: true,
        buildBody: () => JSON.stringify({ model: settings.ai.model }),
        onSuccess: (data) => console.log('Results:', data)
    });

    const handleRegenerateCodebook = useRetryHandler({
        startLog: 'Starting codebook regeneration',
        doneLog: 'Codebook regeneration completed',
        loadingRoute: PAGE_ROUTES.INITIAL_CODEBOOK,
        loaderRoute: LOADER_ROUTES.CODEBOOK_LOADER,
        remoteRoute: REMOTE_SERVER_ROUTES.REGENERATE_CODEBOOK_WITHOUT_QUOTES,
        useLLM: true,
        buildBody: () => JSON.stringify({ model: settings.ai.model, feedback }),
        nextRoute: PAGE_ROUTES.INITIAL_CODEBOOK,
        onSuccess: (data) => console.log('Results:', data),
        onError: (error) => console.error('Error in handleRegenerateCodebook:', error)
    });

    const handleFeedbackSubmit = async () => {
        setIsFeedbackModalOpen(false);
        if (await checkIfDataExists(location.pathname)) {
            openModal('refresh-codebook-submitted', async () => {
                await resetDataAfterPage(location.pathname);
                await handleRegenerateCodebook();
            });
        } else {
            loadingDispatch({ type: 'SET_REST_UNDONE', route: location.pathname });
            handleRegenerateCodebook();
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
                <header className="flex-none py-4">
                    <h1>Initial Codebook</h1>
                </header>

                <main className="flex-1 overflow-hidden flex flex-col">
                    <div className="flex-1 overflow-auto" ref={tableRef}>
                        <table
                            className="w-full border-separate border-spacing-0"
                            id="initial-codebook-table">
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
                                setIsFeedbackModalOpen(true);
                            }}
                            className="px-4 py-2 bg-gray-600 text-white rounded flex justify-center items-center gap-2">
                            <DetailsLLMIcon className="h-6 w-6" />
                            Redo with feedback
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

import { useRef, useEffect } from 'react';
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

    const { loadingState, loadingDispatch, checkIfDataExists, resetDataAfterPage, openModal } =
        useLoadingContext();
    const hasSavedRef = useRef(false);
    useEffect(() => {
        const timer = createTimer();
        logger.info('Code Creation Page Loaded');

        return () => {
            if (!hasSavedRef.current) {
                saveWorkspaceData();
                hasSavedRef.current = true;
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
        navigate(getCodingLoaderUrl(LOADER_ROUTES.DEDUCTIVE_CODING_LOADER));

        loadingDispatch({
            type: 'SET_LOADING_ROUTE',
            route: PAGE_ROUTES.DEDUCTIVE_CODING
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
        }>(REMOTE_SERVER_ROUTES.DEDUCTIVE_CODING, {
            method: 'POST',
            body: JSON.stringify({
                dataset_id: datasetId,
                model: settings.ai.model,
                workspace_id: currentWorkspace!.id,
                final_codebook: initialCodebookTable,
                main_topic: mainTopic,
                additional_info: additionalInfo,
                research_questions: researchQuestions,
                keyword_table: keywordTable.filter(
                    (keywordRow) => keywordRow.isMarked !== undefined
                ),
                unseen_post_ids: unseenPostIds
            })
        });

        if (error) {
            console.error('Error in handleNextClick:', error);
            if (error.name !== 'AbortError') {
                toast.error('Error generating codebook. Please try again.');
                navigate(PAGE_ROUTES.INITIAL_CODEBOOK);
                loadingDispatch({
                    type: 'SET_LOADING_DONE_ROUTE',
                    route: PAGE_ROUTES.DEDUCTIVE_CODING
                });
                throw new Error(error.message);
            }
            return;
        }

        console.log('Results:', results);

        // if (settings.general.manualCoding) {
        //     toast.info(
        //         'LLM has finished coding data. You can head back to Deductive Coding page to see the results',
        //         {
        //             autoClose: false
        //         }
        //     );
        // }

        dispatchUnseenPostResponse({
            type: 'SET_RESPONSES',
            responses: results['data'].map((response) => ({
                ...response,
                isMarked: true,
                type: 'LLM',
                comment: '',
                theme: ''
            }))
        });
        // setSampledPostResponseCopy([...sampledPostResponse]);
        loadingDispatch({
            type: 'SET_LOADING_DONE_ROUTE',
            route: PAGE_ROUTES.DEDUCTIVE_CODING
        });
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
                                    <tr key={index} className="text-center">
                                        {/* Non-editable Code column */}
                                        <td
                                            className="border border-gray-400 p-2 max-w-32 overflow-wrap"
                                            id={`initial-code-${index}`}>
                                            {entry.code}
                                        </td>
                                        {/* Editable Definition column */}
                                        <td
                                            className="border border-gray-400 p-2 overflow-wrap"
                                            id={`initial-definition-${index}`}>
                                            <textarea
                                                className="w-full p-2 border border-gray-300 rounded resize-none h-24"
                                                value={entry.definition}
                                                onChange={(e) =>
                                                    handleDefinitionChange(index, e.target.value)
                                                }
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </main>

                <footer id="bottom-navigation" className="flex-none">
                    <NavigationBottomBar
                        previousPage={PAGE_ROUTES.CODEBOOK_CREATION}
                        nextPage={PAGE_ROUTES.DEDUCTIVE_CODING}
                        isReady={true}
                        onNextClick={handleNextClick}
                    />
                </footer>
            </div>
        </TutorialWrapper>
    );
};

export default InitialCodeBook;

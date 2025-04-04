import { FC, useState, useEffect, useRef, useImperativeHandle } from 'react';
import {
    LOADER_ROUTES,
    PAGE_ROUTES,
    ROUTES,
    WORD_CLOUD_MIN_THRESHOLD
} from '../../constants/Coding/shared';
import NavigationBottomBar from '../../components/Coding/Shared/navigation-bottom-bar';
import KeywordCloud from '../../components/Coding/KeywordCloud/cloud';
import { useLogger } from '../../context/logging-context';
import { MODEL_LIST, REMOTE_SERVER_ROUTES, TooltipMessages } from '../../constants/Shared';
import { createTimer } from '../../utility/timer';
import { useCodingContext } from '../../context/coding-context';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCollectionContext } from '../../context/collection-context';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import getServerUtils from '../../hooks/Shared/get-server-url';
import { getCodingLoaderUrl } from '../../utility/get-loader-url';
import { DetailsLLMIcon, GeminiIcon } from '../../components/Shared/Icons';
// Import the TutorialWrapper and TutorialStep types
import TutorialWrapper from '../../components/Shared/tutorial-wrapper';
import { TutorialStep } from '../../components/Shared/custom-tutorial-overlay';
import { useLoadingContext } from '../../context/loading-context';
import { StepHandle } from '../../types/Shared';
import { ROUTES as SHARED_ROUTES } from '../../constants/Shared';
import { useApi } from '../../hooks/Shared/use-api';
import { useSettings } from '../../context/settings-context';

const KeywordCloudPage: FC = () => {
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
    const [feedback, setFeedback] = useState('');

    const logger = useLogger();
    const navigate = useNavigate();

    const {
        mainTopic,
        additionalInfo,
        selectedKeywords,
        setSelectedKeywords,
        setKeywords,
        keywords,
        keywordTable,
        dispatchKeywordsTable,
        researchQuestions,
        selectedWords
    } = useCodingContext();
    const { settings } = useSettings();
    const location = useLocation();
    const { datasetId } = useCollectionContext();
    const { saveWorkspaceData } = useWorkspaceUtils();
    const [response, setResponse] = useState<string[]>(
        // keywordTable.map((keyword) => ({
        //     word: keyword.word,
        //     description: keyword.description,
        //     inclusion_criteria: keyword.inclusion_criteria,
        //     exclusion_criteria: keyword.exclusion_criteria,
        //     isMarked: true
        // }))
        keywords
    );
    const { getServerUrl } = getServerUtils();
    const { fetchLLMData } = useApi();
    const hasSavedRef = useRef(false);

    const { loadingState, loadingDispatch, openModal, checkIfDataExists, resetDataAfterPage } =
        useLoadingContext();
    const stepRoute = location.pathname;

    useEffect(() => {
        const timer = createTimer();
        logger.info('Loaded Keyword cloud Page');

        return () => {
            if (!hasSavedRef.current) {
                saveWorkspaceData();
                hasSavedRef.current = true;
            }
            logger.info('Unloaded Keyword cloud Page').then(() => {
                logger.time('Keyword cloud Page stay time', { time: timer.end() });
            });
        };
    }, []);

    const toggleKeywordSelection = (word: string) => {
        if (word === mainTopic) return;

        setSelectedKeywords((prevSelected) =>
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

        if (checkIfDataExists(location.pathname)) {
            openModal('keyword-feedback-submitted', async () => {
                await resetDataAfterPage(location.pathname);
                await refreshKeywordCloud();
            });
        } else {
            loadingDispatch({
                type: 'SET_REST_UNDONE',
                route: location.pathname
            });
            refreshKeywordCloud();
        }
    };

    const refreshKeywordCloud = async () => {
        await logger.info('Regenerating Keyword Cloud');
        loadingDispatch({
            type: 'SET_LOADING_ROUTE',
            route: PAGE_ROUTES.KEYWORD_CLOUD
        });
        navigate(getCodingLoaderUrl(LOADER_ROUTES.THEME_LOADER));

        const { data: results, error } = await fetchLLMData<{
            message: string;
            keywords: {
                word: string;
                description: string;
                inclusion_criteria: string[];
                exclusion_criteria: string[];
            }[];
        }>(REMOTE_SERVER_ROUTES.REGENERATE_KEYWORDS, {
            method: 'POST',
            body: JSON.stringify({
                model: settings.ai.model,
                mainTopic,
                additionalInfo,
                researchQuestions,
                unselectedKeywords: keywords.filter(
                    (keyword) => !selectedKeywords.includes(keyword)
                ),
                selectedKeywords,
                extraFeedback: feedback,
                datasetId
            })
        });

        if (error) {
            console.error('Error regenerating Keyword Cloud:', error);
            if (error.name !== 'AbortError') {
                loadingDispatch({
                    type: 'SET_LOADING_DONE_ROUTE',
                    route: PAGE_ROUTES.KEYWORD_CLOUD
                });
            }
            navigate(PAGE_ROUTES.KEYWORD_CLOUD);
            return;
        }
        console.log(results, 'Keyword Cloud Page');

        const newKeywords: {
            word: string;
            description: string;
            inclusion_criteria: string[];
            exclusion_criteria: string[];
        }[] = results.keywords ?? [];

        setResponse((prevResponse) => [...prevResponse, ...newKeywords.map((k) => k.word)]);

        dispatchKeywordsTable({
            type: 'ADD_MANY',
            entries: newKeywords.map((keyword) => ({
                word: keyword.word,
                description: keyword.description,
                inclusion_criteria: keyword.inclusion_criteria,
                exclusion_criteria: keyword.exclusion_criteria,
                isMarked: true
            }))
        });

        setKeywords((prevKeywords) => {
            const filteredPrevKeywords = prevKeywords.filter((keyword) =>
                selectedKeywords.includes(keyword)
            );
            const filteredNewKeywords = newKeywords
                .filter((keyword) => !filteredPrevKeywords.includes(keyword.word))
                .map((keyword) => keyword.word);
            return [...filteredPrevKeywords, ...filteredNewKeywords];
        });
        loadingDispatch({
            type: 'SET_LOADING_DONE_ROUTE',
            route: PAGE_ROUTES.KEYWORD_CLOUD
        });

        navigate(PAGE_ROUTES.KEYWORD_CLOUD);
        await logger.info('Keyword Cloud refreshed');
        console.log('Keyword Cloud refreshed');
    };

    const refreshKeywords = () => {
        // Open the feedback modal
        setIsFeedbackOpen(true);
    };

    const handleNextClick = async (e: any) => {
        e.preventDefault();
        await logger.info('Starting Codebook Generation');
        console.log('Navigating to codebook');
        // navigate(getCodingLoaderUrl(LOADER_ROUTES.CODEBOOK_LOADER));

        console.log('response', response, selectedKeywords);

        loadingDispatch({
            type: 'SET_LOADING_ROUTE',
            route: PAGE_ROUTES.KEYWORD_TABLE
        });
        navigate(
            getCodingLoaderUrl(LOADER_ROUTES.DATA_LOADING_LOADER, {
                text: 'Generating Keyword Definitions'
            })
        );

        const { data: results, error } = await fetchLLMData<{
            message: string;
            results: {
                word: string;
                description: string;
                inclusion_criteria: string[];
                exclusion_criteria: string[];
            }[];
        }>(REMOTE_SERVER_ROUTES.GENERATE_KEYWORD_DEFINITIONS, {
            method: 'POST',
            body: JSON.stringify({
                model: settings.ai.model,
                main_topic: mainTopic,
                additional_info: additionalInfo,
                research_questions: researchQuestions,
                selected_words: [...new Set(selectedKeywords)],
                dataset_id: datasetId
            })
        });

        if (error) {
            console.error('Error regenerating Keyword Cloud:', error);
            if (error.name !== 'AbortError') {
                loadingDispatch({
                    type: 'SET_LOADING_DONE_ROUTE',
                    route: PAGE_ROUTES.KEYWORD_TABLE
                });
            }
            navigate(PAGE_ROUTES.KEYWORD_CLOUD);
            return;
        }
        console.log(results, 'Keyword Table Page');

        dispatchKeywordsTable({
            type: 'INITIALIZE',
            entries: results.results.map((res) => ({ ...res, isMarked: true }))
        });

        loadingDispatch({
            type: 'SET_LOADING_DONE_ROUTE',
            route: PAGE_ROUTES.KEYWORD_TABLE
        });
        await logger.info('Codebook Generation completed');
    };

    const handleSelectAll = (selectAll: boolean) => {
        if (selectAll) {
            setSelectedKeywords((prev) => [mainTopic, ...keywords]);
        } else {
            setSelectedKeywords((prev) => prev.filter((keyword) => keyword === mainTopic));
        }
    };

    const checkIfReady = selectedKeywords.length > WORD_CLOUD_MIN_THRESHOLD;
    const allSelected = keywords.every((keyword) => selectedKeywords.includes(keyword));

    // Define tutorial steps for the Keyword Cloud page.
    const steps: TutorialStep[] = [
        {
            target: '#keyword-cloud',
            content:
                'This is your Keyword Cloud. Click on keywords to select or deselect them. The main topic is fixed. You can edit or delete the keywords as you wish.',
            placement: 'bottom'
        },
        {
            target: '.keyword2',
            content:
                'These are your keywords. Click on them to select or deselect them. You can also edit or delete by clicking on the respective icon when hovering.',
            placement: 'right'
        },
        {
            target: '.refresh-keywords-btn',
            content:
                'Click here to refresh the keyword cloud with new suggestions based on your feedback.',
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
            navigate(getCodingLoaderUrl(LOADER_ROUTES.THEME_LOADER));
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
            excludedTarget={`#route-/${SHARED_ROUTES.CODING}/${ROUTES.BACKGROUND_RESEARCH}`}>
            <div className="min-h-page flex justify-between flex-col">
                <div className="relative flex justify-center items-center flex-col">
                    <p className="py-4">
                        These keywords are generated using the context you provided DeTAILS. Please
                        select 5 or more to proceed{' '}
                    </p>
                    {/* Add an id for targeting the tutorial */}
                    <div id="keyword-cloud" className="w-full">
                        <KeywordCloud
                            mainTopic={mainTopic}
                            keywords={keywords}
                            selectedKeywords={selectedKeywords}
                            toggleKeywordSelection={toggleKeywordSelection}
                            setKeywords={setKeywords}
                        />
                    </div>
                    <div className="absolute bottom-0 right-0 flex flex-col gap-y-4">
                        {!allSelected ? (
                            <button
                                title={TooltipMessages.SelectAll}
                                onClick={() => handleSelectAll(true)}
                                className="bg-green-500 text-white px-2 md:px-4 py-1 md:py-2 rounded-md hover:bg-green-600 my-1 md:my-2 lg:text-base text-xs">
                                Select All
                            </button>
                        ) : (
                            <button
                                title={TooltipMessages.DeselectAll}
                                onClick={() => handleSelectAll(false)}
                                className="bg-gray-500 text-white px-2 md:px-4 py-1 md:py-2 rounded-md hover:bg-gray-600 my-1 md:my-2 lg:text-base text-xs">
                                Unselect All
                            </button>
                        )}
                        <button
                            title={TooltipMessages.RefreshKeywords}
                            onClick={refreshKeywords}
                            // Add a CSS class for tutorial targeting
                            className="refresh-keywords-btn bg-gray-600 text-white px-2 md:px-4 py-1 md:py-2 rounded-md hover:bg-gray-600 my-1 md:my-2 lg:text-base text-xs flex justify-center items-center gap-2">
                            <DetailsLLMIcon className="h-6 w-6" /> Refresh keywords
                        </button>
                    </div>
                </div>

                <NavigationBottomBar
                    previousPage={PAGE_ROUTES.CONTEXT_V2}
                    nextPage={PAGE_ROUTES.KEYWORD_TABLE}
                    isReady={checkIfReady}
                    onNextClick={(e) => handleNextClick(e)}
                    disabledTooltipText="Select atleast 5 keywords"
                    // Add an id for targeting the tutorial
                />

                {isFeedbackOpen && (
                    <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50">
                        <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
                            <h2 className="text-xl font-bold mb-4">
                                Why are these words unsatisfactory?
                            </h2>
                            <p className=" mb-3">
                                Word list:{' '}
                                {keywords
                                    .filter((keyword) => !selectedKeywords.includes(keyword))
                                    .join(', ')}
                            </p>
                            <textarea
                                value={feedback}
                                onChange={handleFeedbackChange}
                                className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                rows={4}
                                placeholder="Enter your feedback here..."
                            />
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
        </TutorialWrapper>
    );
};

export default KeywordCloudPage;

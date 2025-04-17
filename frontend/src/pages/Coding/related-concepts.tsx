import { FC, useState, useEffect, useRef, useImperativeHandle } from 'react';
import {
    LOADER_ROUTES,
    PAGE_ROUTES,
    ROUTES,
    WORD_CLOUD_MIN_THRESHOLD
} from '../../constants/Coding/shared';
import NavigationBottomBar from '../../components/Coding/Shared/navigation-bottom-bar';
import KeywordCloud from '../../components/Coding/RelevantConcepts/cloud';
import { useLogger } from '../../context/logging-context';
import { REMOTE_SERVER_ROUTES, TooltipMessages } from '../../constants/Shared';
import { createTimer } from '../../utility/timer';
import { useCodingContext } from '../../context/coding-context';
import { useLocation, useNavigate } from 'react-router-dom';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import { getCodingLoaderUrl } from '../../utility/get-loader-url';
import { DetailsLLMIcon } from '../../components/Shared/Icons';
import TutorialWrapper from '../../components/Shared/tutorial-wrapper';
import { TutorialStep } from '../../components/Shared/custom-tutorial-overlay';
import { useLoadingContext } from '../../context/loading-context';
import { Keyword } from '../../types/Shared';
import { ROUTES as SHARED_ROUTES } from '../../constants/Shared';
import { useApi } from '../../hooks/Shared/use-api';
import { useSettings } from '../../context/settings-context';

const KeywordCloudPage: FC = () => {
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
    const [feedback, setFeedback] = useState('');

    const logger = useLogger();
    const navigate = useNavigate();

    const { mainTopic, selectedKeywords, setSelectedKeywords, setKeywords, keywords } =
        useCodingContext();
    const { settings } = useSettings();
    const location = useLocation();
    const { saveWorkspaceData } = useWorkspaceUtils();

    const { fetchLLMData } = useApi();
    const hasSavedRef = useRef(false);

    const { loadingState, loadingDispatch, openModal, checkIfDataExists, resetDataAfterPage } =
        useLoadingContext();
    const stepRoute = location.pathname;

    useEffect(() => {
        const timer = createTimer();
        logger.info('Loaded Relevant concepts Page');

        return () => {
            if (!hasSavedRef.current) {
                hasSavedRef.current = true;
                saveWorkspaceData().finally(() => {
                    hasSavedRef.current = false;
                });
            }
            logger.info('Unloaded Relevant concepts Page').then(() => {
                logger.time('Relevant concepts Page stay time', { time: timer.end() });
            });
        };
    }, []);

    const toggleKeywordSelection = (keyword: Keyword) => {
        if (keyword.word === mainTopic) return;
        setSelectedKeywords((prevSelected) =>
            prevSelected.some((k) => k === keyword.id)
                ? prevSelected.filter((k) => k !== keyword.id)
                : [...prevSelected, keyword.id]
        );
    };

    const handleFeedbackChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setFeedback(event.target.value);
    };

    const submitFeedback = async () => {
        console.log('User feedback:', feedback);
        setFeedback('');
        setIsFeedbackOpen(false);

        if (await checkIfDataExists(location.pathname)) {
            openModal('relevant-concepts-feedback-submitted', async () => {
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
        await logger.info('Regenerating Relevant concepts');
        loadingDispatch({
            type: 'SET_LOADING_ROUTE',
            route: PAGE_ROUTES.RELATED_CONCEPTS
        });
        navigate(getCodingLoaderUrl(LOADER_ROUTES.THEME_LOADER));

        const { data: results, error } = await fetchLLMData<{
            message: string;
        }>(REMOTE_SERVER_ROUTES.REGENERATE_KEYWORDS, {
            method: 'POST',
            body: JSON.stringify({
                model: settings.ai.model,
                extraFeedback: feedback
            })
        });

        if (error) {
            console.error('Error regenerating Relevant concepts:', error);
            if (error.name !== 'AbortError') {
                loadingDispatch({
                    type: 'SET_LOADING_DONE_ROUTE',
                    route: PAGE_ROUTES.RELATED_CONCEPTS
                });
            }
            navigate(PAGE_ROUTES.RELATED_CONCEPTS);
            return;
        }
        console.log(results, 'Relevant concepts Page');

        loadingDispatch({
            type: 'SET_LOADING_DONE_ROUTE',
            route: PAGE_ROUTES.RELATED_CONCEPTS
        });

        navigate(PAGE_ROUTES.RELATED_CONCEPTS);
        await logger.info('Relevant concepts refreshed');
        console.log('Relevant concepts refreshed');
    };

    const refreshKeywords = () => {
        setIsFeedbackOpen(true);
    };

    const handleNextClick = async (e: any) => {
        e.preventDefault();
        await logger.info('Starting concept outline generation');
        console.log('Navigating to codebook');

        console.log('response', selectedKeywords);

        loadingDispatch({
            type: 'SET_LOADING_ROUTE',
            route: PAGE_ROUTES.CONCEPT_OUTLINE
        });
        navigate(
            getCodingLoaderUrl(LOADER_ROUTES.DATA_LOADING_LOADER, {
                text: 'Generating Keyword Definitions'
            })
        );

        const { data: results, error } = await fetchLLMData<{
            message: string;
        }>(REMOTE_SERVER_ROUTES.GENERATE_KEYWORD_DEFINITIONS, {
            method: 'POST',
            body: JSON.stringify({
                model: settings.ai.model
            })
        });

        if (error) {
            console.error('Error regenerating Relevant concepts:', error);
            if (error.name !== 'AbortError') {
                loadingDispatch({
                    type: 'SET_LOADING_DONE_ROUTE',
                    route: PAGE_ROUTES.CONCEPT_OUTLINE
                });
            }
            navigate(PAGE_ROUTES.RELATED_CONCEPTS);
            return;
        }
        console.log(results, 'Concept outline Page');

        loadingDispatch({
            type: 'SET_LOADING_DONE_ROUTE',
            route: PAGE_ROUTES.CONCEPT_OUTLINE
        });
        await logger.info('concept outline generation completed');
    };

    const handleSelectAll = (selectAll: boolean) => {
        if (selectAll) {
            setSelectedKeywords([...keywords.map((k) => k.id), '1']);
        } else {
            setSelectedKeywords([
                ...keywords.filter((k) => k.word === mainTopic).map((k) => k.id),
                '1'
            ]);
        }
    };

    const checkIfReady = selectedKeywords.length > WORD_CLOUD_MIN_THRESHOLD;
    const allSelected = keywords.every((keyword) => selectedKeywords.find((k) => k === keyword.id));
    console.log(
        'allSelected',
        allSelected,
        'selectedKeywords',
        selectedKeywords,
        'keywords',
        keywords
    );

    const steps: TutorialStep[] = [
        {
            target: '#keyword-cloud',
            content:
                'This is your Relevant Concepts page. Click on concepts to select or deselect them. The main topic is fixed. You can edit or delete the keywords as you wish.',
            placement: 'bottom'
        },
        {
            target: '.keyword2',
            content:
                'These are your concepts. Click on them to select or deselect them. You can also edit or delete by clicking on the respective icon when hovering.',
            placement: 'right'
        },
        {
            target: '.refresh-keywords-btn',
            content:
                'Click here to refresh the Relevant concepts with new suggestions based on your feedback.',
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
                    <div id="keyword-cloud" className="w-full">
                        <KeywordCloud
                            mainTopic={mainTopic}
                            keywords={keywords}
                            selectedKeywords={selectedKeywords}
                            toggleKeywordSelection={toggleKeywordSelection}
                            setKeywords={setKeywords}
                            setSelectedKeywords={setSelectedKeywords}
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
                            className="refresh-keywords-btn bg-gray-600 text-white px-2 md:px-4 py-1 md:py-2 rounded-md hover:bg-gray-600 my-1 md:my-2 lg:text-base text-xs flex justify-center items-center gap-2">
                            <DetailsLLMIcon className="h-6 w-6" /> Refresh keywords
                        </button>
                    </div>
                </div>

                <NavigationBottomBar
                    previousPage={PAGE_ROUTES.CONTEXT}
                    nextPage={PAGE_ROUTES.CONCEPT_OUTLINE}
                    isReady={checkIfReady}
                    onNextClick={(e) => handleNextClick(e)}
                    disabledTooltipText="Select atleast 5 keywords"
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
                                    .filter(
                                        (keyword) => !selectedKeywords.find((k) => k === keyword.id)
                                    )
                                    .map((keyword) => keyword.word)
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

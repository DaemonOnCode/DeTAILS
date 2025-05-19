import { FC, useState, useEffect, useRef, useImperativeHandle } from 'react';
import {
    LOADER_ROUTES,
    PAGE_ROUTES,
    ROUTES,
    WORD_CLOUD_MIN_THRESHOLD
} from '../../constants/Coding/shared';
import NavigationBottomBar from '../../components/Coding/Shared/navigation-bottom-bar';
import ConceptCloud from '../../components/Coding/RelevantConcepts/cloud';
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
import { Concept } from '../../types/Shared';
import { ROUTES as SHARED_ROUTES } from '../../constants/Shared';
import { useSettings } from '../../context/settings-context';
import { useNextHandler, useRetryHandler } from '../../hooks/Coding/use-handler-factory';

const ConceptCloudPage: FC = () => {
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
    const [feedback, setFeedback] = useState('');

    const logger = useLogger();
    const navigate = useNavigate();

    const { mainTopic, selectedConcepts, setSelectedConcepts, setConcepts, concepts } =
        useCodingContext();
    const { settings } = useSettings();
    const location = useLocation();
    const { saveWorkspaceData } = useWorkspaceUtils();

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

    const toggleConceptSelection = (concept: Concept) => {
        if (concept.word === mainTopic) return;
        setSelectedConcepts((prevSelected) =>
            prevSelected.some((k) => k === concept.id)
                ? prevSelected.filter((k) => k !== concept.id)
                : [...prevSelected, concept.id]
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
                await refreshConceptCloud();
            });
        } else {
            loadingDispatch({
                type: 'SET_REST_UNDONE',
                route: location.pathname
            });
            refreshConceptCloud();
        }
    };

    const refreshConceptCloud = useRetryHandler({
        startLog: 'Regenerating Relevant concepts',
        doneLog: 'Relevant concepts refreshed',
        loadingRoute: PAGE_ROUTES.RELATED_CONCEPTS,
        loaderRoute: LOADER_ROUTES.THEME_LOADER,
        remoteRoute: REMOTE_SERVER_ROUTES.REGENERATE_KEYWORDS,
        useLLM: true,
        buildBody: () =>
            JSON.stringify({
                model: settings.ai.model,
                extraFeedback: feedback
            }),
        onSuccess: (data) => {
            console.log(data, 'Relevant concepts Page');
        },
        onError: (error) => {
            console.error('Error regenerating Relevant concepts:', error);
        }
    });

    const refreshConcepts = () => {
        setIsFeedbackOpen(true);
    };

    const handleNextClick = useNextHandler({
        startLog: 'Starting concept outline generation',
        doneLog: 'concept outline generation completed',
        loadingRoute: PAGE_ROUTES.CONCEPT_OUTLINE,
        loaderRoute: LOADER_ROUTES.DATA_LOADING_LOADER,
        loaderParams: { text: 'Generating Concept Outline' },
        remoteRoute: REMOTE_SERVER_ROUTES.GENERATE_KEYWORD_DEFINITIONS,
        useLLM: true,
        buildBody: () =>
            JSON.stringify({
                model: settings.ai.model
            }),
        onSuccess: (data) => {
            console.log(data, 'Concept outline Page');
        }
    });

    const handleSelectAll = (selectAll: boolean) => {
        if (selectAll) {
            setSelectedConcepts([...concepts.map((k) => k.id), '1']);
        } else {
            setSelectedConcepts([
                ...concepts.filter((k) => k.word === mainTopic).map((k) => k.id),
                '1'
            ]);
        }
    };

    const checkIfReady = selectedConcepts.length > WORD_CLOUD_MIN_THRESHOLD;
    const allSelected = concepts.every((concept) => selectedConcepts.find((k) => k === concept.id));
    console.log(
        'allSelected',
        allSelected,
        'selectedConcepts',
        selectedConcepts,
        'concepts',
        concepts
    );

    const steps: TutorialStep[] = [
        {
            target: '#concept-cloud',
            content:
                'This is your Related Concepts page. Click on concepts to select or deselect them. The main topic is fixed. You can edit or delete the concepts as you wish.',
            placement: 'bottom'
        },
        {
            target: '.concept2',
            content:
                'These are your Related concepts. Click on them to select or deselect them. You can also edit or delete by clicking on the respective icon when hovering.',
            placement: 'right'
        },
        {
            target: '.refresh-concepts-btn',
            content:
                'Click here to refresh the Related concepts page with new suggestions based on your feedback.',
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
                        These related concepts are generated using the context you provided DeTAILS.
                        Please select all concepts that best align with your thought process.{' '}
                    </p>
                    <div id="concept-cloud" className="w-full">
                        <ConceptCloud
                            mainTopic={mainTopic}
                            concepts={concepts}
                            selectedConcepts={selectedConcepts}
                            toggleConceptSelection={toggleConceptSelection}
                            setConcepts={setConcepts}
                            setSelectedConcepts={setSelectedConcepts}
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
                            title={TooltipMessages.RefreshConcepts}
                            onClick={refreshConcepts}
                            className="refresh-concepts-btn bg-gray-600 text-white px-2 md:px-4 py-1 md:py-2 rounded-md hover:bg-gray-600 my-1 md:my-2 lg:text-base text-xs flex justify-center items-center gap-2">
                            <DetailsLLMIcon className="h-6 w-6" /> Redo with feedback
                        </button>
                    </div>
                </div>

                <NavigationBottomBar
                    previousPage={PAGE_ROUTES.CONTEXT}
                    nextPage={PAGE_ROUTES.CONCEPT_OUTLINE}
                    isReady={checkIfReady}
                    onNextClick={(e) => handleNextClick(e)}
                    disabledTooltipText={`Select atleast ${WORD_CLOUD_MIN_THRESHOLD} concepts`}
                />

                {isFeedbackOpen && (
                    <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50">
                        <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
                            <h2 className="text-xl font-bold mb-4">
                                Why are these words unsatisfactory?
                            </h2>
                            <p className=" mb-3">
                                Word list:{' '}
                                {concepts
                                    .filter(
                                        (concept) => !selectedConcepts.find((k) => k === concept.id)
                                    )
                                    .map((concept) => concept.word)
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

export default ConceptCloudPage;

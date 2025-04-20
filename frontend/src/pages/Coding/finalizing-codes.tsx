import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import NavigationBottomBar from '../../components/Coding/Shared/navigation-bottom-bar';
import TutorialWrapper from '../../components/Shared/tutorial-wrapper';
import { REMOTE_SERVER_ROUTES } from '../../constants/Shared';
import { LOADER_ROUTES, PAGE_ROUTES } from '../../constants/Coding/shared';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import UnplacedCodesBox from '../../components/Coding/Themes/unplaced-box';
import ReviewToggle from '../../components/Coding/UnifiedCoding/review-toggle';
import ValidationTable from '../../components/Coding/UnifiedCoding/validation-table';
import Bucket from '../../components/Coding/Themes/bucket';
import { useCodingContext } from '../../context/coding-context';
import { DetailsLLMIcon } from '../../components/Shared/Icons';
import { useCollectionContext } from '../../context/collection-context';
import { useLoadingContext } from '../../context/loading-context';
import { useSettings } from '../../context/settings-context';
import { getCodingLoaderUrl } from '../../utility/get-loader-url';
import { useApi } from '../../hooks/Shared/use-api';
import { useLogger } from '../../context/logging-context';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import { createTimer } from '../../utility/timer';
import { getGroupedCodeOfSubCode } from '../../utility/theme-finder';
import { toast } from 'react-toastify';
import { useUndo } from '../../hooks/Shared/use-undo';
import useScrollRestoration from '../../hooks/Shared/use-scroll-restoration';

const FinalzingCodes = () => {
    const location = useLocation();
    const { sampledPostResponse, unseenPostResponse, groupedCodes, dispatchGroupedCodes } =
        useCodingContext();
    const { loadingState, openModal, checkIfDataExists, resetDataAfterPage, loadingDispatch } =
        useLoadingContext();
    const { performWithUndoForReducer } = useUndo();
    const { datasetId } = useCollectionContext();
    const { settings } = useSettings();
    const navigate = useNavigate();
    const { fetchLLMData } = useApi();
    const logger = useLogger();
    const { saveWorkspaceData } = useWorkspaceUtils();
    const hasSavedRef = useRef(false);
    const [review, setReview] = useState(true);

    const stepRoute = location.pathname;

    const [searchQuery, setSearchQuery] = useState('');
    const [noResults, setNoResults] = useState(false);
    const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
    const [feedback, setFeedback] = useState('');
    const codeRefs = useRef(new Map());

    const normalBuckets = useMemo(() => {
        return groupedCodes.filter((bucket) => bucket.id !== null);
    }, [groupedCodes]);

    const unplacedBucket = useMemo(() => {
        return groupedCodes.find((bucket) => bucket.id === null);
    }, [groupedCodes]);

    const unplacedSubCodes = unplacedBucket ? unplacedBucket.codes : [];

    const setCodeRef = useCallback((code, node) => {
        if (node) {
            codeRefs.current.set(code, node);
        } else {
            codeRefs.current.delete(code);
        }
    }, []);

    const handleSearch = () => {
        const trimmedQuery = searchQuery.trim().toLowerCase();
        const allSubCodes = groupedCodes.flatMap((bucket) => bucket.codes);
        const matchingCodes = allSubCodes.filter((code) =>
            code.trim().toLowerCase().includes(trimmedQuery)
        );

        codeRefs.current.forEach((el) => {
            if (el) el.classList.remove('highlight');
        });

        if (matchingCodes.length > 0) {
            setNoResults(false);
            let firstMatchElement = null;

            matchingCodes.forEach((code) => {
                const el = codeRefs.current.get(code);
                if (el) {
                    el.classList.add('highlight');
                    if (!firstMatchElement) firstMatchElement = el;
                }
            });

            if (firstMatchElement) {
                firstMatchElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        } else {
            setNoResults(true);
        }
    };

    useEffect(() => {
        if (searchQuery) {
            handleSearch();
        } else {
            codeRefs.current.forEach((el) => {
                if (el) el.classList.remove('highlight');
            });
            setNoResults(false);
        }
    }, [searchQuery]);

    const codeResponses = [
        ...sampledPostResponse.map((r) => ({
            postId: r.postId,
            id: r.id,
            code: getGroupedCodeOfSubCode(r.code, groupedCodes),
            quote: r.quote,
            explanation: r.explanation,
            comment: r.comment,
            subCode: r.code
        })),
        ...unseenPostResponse.map((r) => ({
            postId: r.postId,
            id: r.id,
            code: getGroupedCodeOfSubCode(r.code, groupedCodes),
            quote: r.quote,
            explanation: r.explanation,
            comment: r.comment,
            subCode: r.code
        }))
    ];

    const { scrollRef: codeRef, storageKey: codeStorageKey } = useScrollRestoration(
        `code-list-${review}`
    );
    const { scrollRef: unplacedRef, storageKey: unplacedStorageKey } = useScrollRestoration(
        `unplaced-list-${review}`
    );

    useEffect(() => {
        if (!review) {
            if (codeRef.current) {
                const savedPosition = sessionStorage.getItem(codeStorageKey);
                if (savedPosition) codeRef.current.scrollTop = parseInt(savedPosition, 10);
            }
            if (unplacedRef.current) {
                const savedPosition = sessionStorage.getItem(unplacedStorageKey);
                if (savedPosition) unplacedRef.current.scrollTop = parseInt(savedPosition, 10);
            }
        }
    }, [review, codeRef, unplacedRef, codeStorageKey, unplacedStorageKey]);

    const handleUpdateBucketName = (bucketId, newName) => {
        const action = { type: 'UPDATE_BUCKET_NAME', payload: { bucketId, newName } };
        performWithUndoForReducer(groupedCodes, dispatchGroupedCodes, action);
    };

    const handleDropToBucket = (bucketId, code) => {
        const action = { type: 'MOVE_CODE', payload: { code, targetBucketId: bucketId } };
        performWithUndoForReducer(groupedCodes, dispatchGroupedCodes, action);
    };

    const handleAddBucket = () => {
        const action = { type: 'ADD_BUCKET' };
        performWithUndoForReducer(groupedCodes, dispatchGroupedCodes, action);
    };

    const handleDeleteBucket = (bucketId) => {
        if (bucketId === null) return;
        const action = { type: 'DELETE_BUCKET', payload: bucketId };
        performWithUndoForReducer(groupedCodes, dispatchGroupedCodes, action);
    };

    const handleMoveToMiscellaneous = () => {
        const action = { type: 'MOVE_UNPLACED_TO_MISC' };
        performWithUndoForReducer(groupedCodes, dispatchGroupedCodes, action);
    };

    const handleFeedbackSubmit = async () => {
        setIsFeedbackModalOpen(false);
        if (await checkIfDataExists(location.pathname)) {
            openModal('refresh-reviewing-codes-submitted', async () => {
                await resetDataAfterPage(location.pathname);
                await handleRefreshCodes(feedback);
            });
        } else {
            loadingDispatch({ type: 'SET_REST_UNDONE', route: location.pathname });
            handleRefreshCodes(feedback);
        }
        setFeedback('');
    };

    const handleNextClick = async () => {
        loadingDispatch({ type: 'SET_LOADING_ROUTE', route: PAGE_ROUTES.GENERATING_THEMES });
        navigate(getCodingLoaderUrl(LOADER_ROUTES.THEME_GENERATION_LOADER));

        const { data: results, error } = await fetchLLMData(REMOTE_SERVER_ROUTES.THEME_GENERATION, {
            method: 'POST',
            body: JSON.stringify({ model: settings.ai.model })
        });

        if (error) {
            console.error('Error in handleNextClick:', error);
            if (error.name !== 'AbortError') {
                toast.error('Error generating themes. Please try again.');
                navigate(PAGE_ROUTES.REVIEWING_CODES);
                loadingDispatch({
                    type: 'SET_LOADING_DONE_ROUTE',
                    route: PAGE_ROUTES.GENERATING_THEMES
                });
            }
            return;
        }

        loadingDispatch({ type: 'SET_LOADING_DONE_ROUTE', route: PAGE_ROUTES.GENERATING_THEMES });
    };

    const handleRefreshCodes = async (extraFeedback = '') => {
        loadingDispatch({ type: 'SET_LOADING_ROUTE', route: PAGE_ROUTES.REVIEWING_CODES });
        navigate(
            getCodingLoaderUrl(LOADER_ROUTES.DATA_LOADING_LOADER, { text: 'Reviewing Codes' })
        );

        const { data: results, error } = await fetchLLMData(REMOTE_SERVER_ROUTES.REGROUP_CODES, {
            method: 'POST',
            body: JSON.stringify({ model: settings.ai.model, feedback: extraFeedback })
        });

        if (error) {
            console.error('Error refreshing themes:', error);
            if (error.name !== 'AbortError') {
                loadingDispatch({
                    type: 'SET_LOADING_DONE_ROUTE',
                    route: PAGE_ROUTES.REVIEWING_CODES
                });
            }
            return;
        }

        loadingDispatch({ type: 'SET_LOADING_DONE_ROUTE', route: PAGE_ROUTES.REVIEWING_CODES });
        navigate(PAGE_ROUTES.REVIEWING_CODES);
    };

    const steps = [
        {
            target: '#finalized-main',
            content: 'This is the Reviewing codes page. Here you can review and edit your codes.',
            placement: 'bottom'
        },
        {
            target: '#review-edit-pill',
            content: 'Click this button to toggle between review and edit mode.',
            placement: 'bottom'
        },
        {
            target: '#finalized-code-table',
            content: 'This table displays all the code responses.',
            placement: 'top'
        },
        {
            target: '#proceed-next-step',
            content: 'Step 4: Proceed to next step',
            placement: 'top'
        }
    ];

    useEffect(() => {
        if (loadingState[stepRoute]?.isLoading) {
            navigate(
                getCodingLoaderUrl(LOADER_ROUTES.DATA_LOADING_LOADER, { text: 'reviewing codes' })
            );
        }
    }, []);

    useEffect(() => {
        const timer = createTimer();
        logger.info('Themes Page Loaded');

        return () => {
            if (!hasSavedRef.current) {
                hasSavedRef.current = true;
                saveWorkspaceData().finally(() => {
                    hasSavedRef.current = false;
                });
            }
            logger.info('Themes Page Unloaded').then(() => {
                logger.time('Themes Page stay time', { time: timer.end() });
            });
        };
    }, []);

    if (loadingState[location.pathname]?.isFirstRun) {
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
            excludedTarget={`#route-${PAGE_ROUTES.REVIEWING_CODES}`}>
            <main className="h-page w-full flex flex-col" id="finalized-main">
                {unplacedSubCodes.length > 0 && (
                    <p className="mb-4 text-red-500 text-center">
                        Go into edit mode, place unplaced codes into code buckets to proceed.
                    </p>
                )}
                <ReviewToggle review={review} setReview={setReview} />
                {!review && (
                    <header className="py-4">
                        <div className="flex justify-end items-center">
                            <input
                                type="text"
                                placeholder="Search codes..."
                                className="p-2 border rounded"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </header>
                )}
                <div className="flex flex-col flex-1 overflow-hidden h-full">
                    {review ? (
                        <div className="flex-1 overflow-auto pb-6" id="finalized-code-table">
                            <ValidationTable
                                codeResponses={codeResponses}
                                onViewTranscript={() => {}}
                                dispatchCodeResponses={() => {}}
                                onReRunCoding={() => {}}
                                onUpdateResponses={() => {}}
                                review={true}
                            />
                        </div>
                    ) : (
                        <>
                            <div className="flex flex-col size-full">
                                <DndProvider backend={HTML5Backend} context={window}>
                                    <div className="flex flex-1 overflow-hidden size-full">
                                        <div
                                            className="w-[70%] flex-1 overflow-auto px-4"
                                            ref={codeRef}>
                                            <div className="grid grid-cols-2 gap-6">
                                                {normalBuckets.map((bucket) => (
                                                    <Bucket
                                                        scrollRef={codeRef}
                                                        key={bucket.id}
                                                        theme={bucket}
                                                        onDrop={handleDropToBucket}
                                                        onDelete={handleDeleteBucket}
                                                        onUpdateName={handleUpdateBucketName}
                                                        setCodeRef={setCodeRef}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex flex-col h-full w-[30%] px-4 gap-2">
                                            <div className="flex-1 overflow-auto" ref={unplacedRef}>
                                                <UnplacedCodesBox
                                                    scrollRef={unplacedRef}
                                                    unplacedCodes={unplacedSubCodes}
                                                    onDrop={handleDropToBucket}
                                                    setCodeRef={setCodeRef}
                                                />
                                            </div>
                                            <div className="flex justify-center items-center">
                                                <button
                                                    disabled={!unplacedSubCodes.length}
                                                    className={`${unplacedSubCodes.length ? 'bg-blue-500 cursor-pointer' : 'bg-gray-500 cursor-not-allowed'} p-2 w-fit text-white rounded`}
                                                    onClick={handleMoveToMiscellaneous}>
                                                    Move rest to Miscellaneous
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </DndProvider>
                                <div className="pt-4 flex justify-between">
                                    <button
                                        onClick={handleAddBucket}
                                        className="px-4 py-2 bg-blue-500 text-white rounded">
                                        + Add New Code
                                    </button>
                                    <button
                                        id="refresh-codes-button"
                                        onClick={() => setIsFeedbackModalOpen(true)}
                                        className="px-4 py-2 bg-gray-600 text-white rounded flex justify-center items-center gap-2">
                                        <DetailsLLMIcon className="h-6 w-6" />
                                        Redo with feedback
                                    </button>
                                </div>
                            </div>
                            {isFeedbackModalOpen && (
                                <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50">
                                    <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
                                        <h2 className="text-xl font-bold mb-4">
                                            Provide Feedback (Optional)
                                        </h2>
                                        <p className="mb-3">
                                            Please share any feedback on the current code groupings:
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
                        </>
                    )}
                </div>
                <NavigationBottomBar
                    previousPage={PAGE_ROUTES.FINAL_CODING}
                    nextPage={PAGE_ROUTES.GENERATING_THEMES}
                    isReady={unplacedSubCodes.length === 0}
                    onNextClick={handleNextClick}
                />
            </main>
        </TutorialWrapper>
    );
};

export default FinalzingCodes;

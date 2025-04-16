import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import NavigationBottomBar from '../../components/Coding/Shared/navigation-bottom-bar';
import TutorialWrapper from '../../components/Shared/tutorial-wrapper';
import { REMOTE_SERVER_ROUTES, ROUTES as SHARED_ROUTES } from '../../constants/Shared';
import { LOADER_ROUTES, PAGE_ROUTES } from '../../constants/Coding/shared';
import { TutorialStep } from '../../components/Shared/custom-tutorial-overlay';
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

    const {
        sampledPostResponse,
        unseenPostResponse,
        groupedCodes,
        setGroupedCodes,
        unplacedSubCodes,
        setUnplacedSubCodes,
        setThemes,
        setUnplacedCodes
    } = useCodingContext();
    const { loadingState, openModal, checkIfDataExists, resetDataAfterPage, loadingDispatch } =
        useLoadingContext();
    const { performWithUndo } = useUndo();
    const { datasetId } = useCollectionContext();
    const { settings } = useSettings();
    const navigate = useNavigate();
    const { fetchLLMData } = useApi();
    const logger = useLogger();
    const { saveWorkspaceData } = useWorkspaceUtils();
    const hasSavedRef = useRef(false);
    // State for toggling review vs. edit mode
    const [review, setReview] = useState(true);

    const stepRoute = location.pathname;

    const [searchQuery, setSearchQuery] = useState('');
    const [noResults, setNoResults] = useState(false);
    const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
    const [feedback, setFeedback] = useState('');
    const codeRefs = useRef(new Map<string, HTMLDivElement>());

    const setCodeRef = useCallback((code: string, node: HTMLDivElement | null) => {
        if (node) {
            codeRefs.current.set(code, node);
        } else {
            codeRefs.current.delete(code);
        }
    }, []);

    const handleSearch = () => {
        const trimmedQuery = searchQuery.trim().toLowerCase();
        const allSubCodes = [...groupedCodes.flatMap((group) => group.codes), ...unplacedSubCodes];
        const matchingCodes = allSubCodes.filter((code) => {
            const trimmedCode = code.trim().toLowerCase();
            return trimmedCode.includes(trimmedQuery);
        });

        // Clear previous highlights
        codeRefs.current.forEach((el) => {
            if (el) el.classList.remove('highlight');
        });

        if (matchingCodes.length > 0) {
            setNoResults(false);
            let firstMatchElement: HTMLDivElement | null = null;

            matchingCodes.forEach((code) => {
                const el = codeRefs.current.get(code);
                if (el) {
                    el.classList.add('highlight');
                    if (!firstMatchElement) {
                        firstMatchElement = el; // el is HTMLDivElement here
                    }
                } else {
                    console.log('Element not found for code:', code);
                }
            });

            // TypeScript should narrow firstMatchElement to HTMLDivElement here
            if (firstMatchElement) {
                (firstMatchElement as HTMLDivElement).scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
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
        ...unseenPostResponse.map((r) => {
            return {
                postId: r.postId,
                id: r.id,
                code: getGroupedCodeOfSubCode(r.code, groupedCodes),
                quote: r.quote,
                explanation: r.explanation,
                comment: r.comment,
                subCode: r.code
            };
        })
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
                if (savedPosition) {
                    codeRef.current.scrollTop = parseInt(savedPosition, 10);
                }
            }
            if (unplacedRef.current) {
                const savedPosition = sessionStorage.getItem(unplacedStorageKey);
                if (savedPosition) {
                    unplacedRef.current.scrollTop = parseInt(savedPosition, 10);
                }
            }
        }
    }, [review, codeRef, unplacedRef, codeStorageKey, unplacedStorageKey]);

    useEffect(() => {
        if (codeRef.current) {
            console.log(`Scroll listener attached to code-list`);
        } else {
            console.log(`No element found for code-list`);
        }
    }, []);

    // Handler for dropping a code into a bucket
    const handleDropToBucket = (bucketId: string, code: string) => {
        performWithUndo(
            [groupedCodes, unplacedSubCodes],
            [setGroupedCodes, setUnplacedSubCodes],
            () => {
                setGroupedCodes((prevBuckets) =>
                    prevBuckets.map((bucket) => {
                        if (bucket.id === bucketId) {
                            if (!bucket.codes.includes(code)) {
                                return { ...bucket, codes: [...bucket.codes, code] };
                            }
                        } else {
                            return { ...bucket, codes: bucket.codes.filter((c) => c !== code) };
                        }
                        return bucket;
                    })
                );
                setUnplacedSubCodes((prevCodes) => prevCodes.filter((c) => c !== code));
            }
        );
    };

    // Handler for dropping a code back into the unplaced box
    const handleDropToUnplaced = (code: string) => {
        performWithUndo(
            [groupedCodes, unplacedSubCodes],
            [setGroupedCodes, setUnplacedSubCodes],
            () => {
                setUnplacedSubCodes((prevCodes) =>
                    prevCodes.includes(code) ? prevCodes : [...prevCodes, code]
                );
                setGroupedCodes((prevBuckets) =>
                    prevBuckets.map((bucket) => ({
                        ...bucket,
                        codes: bucket.codes.filter((c) => c !== code)
                    }))
                );
            }
        );
    };

    // Add a new bucket for codes
    const handleAddBucket = () => {
        performWithUndo([groupedCodes], [setGroupedCodes], () => {
            const newBucket = {
                id: (groupedCodes.length + 1).toString(),
                name: 'New Group',
                codes: []
            };
            setGroupedCodes([...groupedCodes, newBucket]);
        });
    };

    // Delete a bucket and move its codes to unplaced
    const handleDeleteBucket = (bucketId: string) => {
        performWithUndo(
            [groupedCodes, unplacedSubCodes],
            [setGroupedCodes, setUnplacedSubCodes],
            () => {
                const bucketToDelete = groupedCodes.find((bucket) => bucket.id === bucketId);
                if (bucketToDelete) {
                    setUnplacedSubCodes((prevCodes) => [...prevCodes, ...bucketToDelete.codes]);
                }
                setGroupedCodes((prevBuckets) =>
                    prevBuckets.filter((bucket) => bucket.id !== bucketId)
                );
            }
        );
    };

    const handleFeedbackSubmit = async () => {
        setIsFeedbackModalOpen(false);
        if (await checkIfDataExists(location.pathname)) {
            openModal('refresh--finalizing-codes-submitted', async () => {
                await resetDataAfterPage(location.pathname);
                await handleRefreshCodes(feedback);
            });
        } else {
            loadingDispatch({
                type: 'SET_REST_UNDONE',
                route: location.pathname
            });
            handleRefreshCodes(feedback);
        }
        setFeedback('');
    };

    const handleNextClick = async () => {
        loadingDispatch({
            type: 'SET_LOADING_ROUTE',
            route: PAGE_ROUTES.GENERATING_THEMES
        });
        navigate(getCodingLoaderUrl(LOADER_ROUTES.THEME_GENERATION_LOADER));

        const { data: results, error } = await fetchLLMData<{
            message: string;
            data: {
                themes: any[];
                unplaced_codes: any[];
            };
        }>(REMOTE_SERVER_ROUTES.THEME_GENERATION, {
            method: 'POST',
            body: JSON.stringify({
                model: settings.ai.model
            })
        });

        if (error) {
            console.error('Error in handleNextClick:', error);
            if (error.name !== 'AbortError') {
                toast.error('Error generating themes. Please try again. ' + (error.message ?? ''));
                navigate(PAGE_ROUTES.REVIEWING_CODES);
                loadingDispatch({
                    type: 'SET_LOADING_DONE_ROUTE',
                    route: PAGE_ROUTES.GENERATING_THEMES
                });
                throw new Error(error.message);
            }
            return;
        }
        console.log('Results:', results);

        loadingDispatch({
            type: 'SET_LOADING_DONE_ROUTE',
            route: PAGE_ROUTES.GENERATING_THEMES
        });
    };

    const handleRefreshCodes = async (extraFeedback = '') => {
        loadingDispatch({
            type: 'SET_LOADING_ROUTE',
            route: PAGE_ROUTES.REVIEWING_CODES
        });
        navigate(
            getCodingLoaderUrl(LOADER_ROUTES.DATA_LOADING_LOADER, {
                text: 'Finalizing codes'
            })
        );

        const { data: results, error } = await fetchLLMData<{
            message: string;
            data: {
                higher_level_codes: any[];
                unplaced_codes: any[];
            };
        }>(REMOTE_SERVER_ROUTES.REGROUP_CODES, {
            method: 'POST',
            body: JSON.stringify({
                model: settings.ai.model,
                feedback: extraFeedback
            })
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

        console.log('Results:', results);

        loadingDispatch({
            type: 'SET_LOADING_DONE_ROUTE',
            route: PAGE_ROUTES.REVIEWING_CODES
        });
        navigate(PAGE_ROUTES.REVIEWING_CODES);
    };

    useEffect(() => {
        if (loadingState[stepRoute]?.isLoading) {
            navigate(
                getCodingLoaderUrl(LOADER_ROUTES.DATA_LOADING_LOADER, {
                    text: 'Finalizing codes'
                })
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

    const handleMoveToMiscellaneous = useCallback(() => {
        performWithUndo(
            [groupedCodes, unplacedSubCodes],
            [setGroupedCodes, setUnplacedSubCodes],
            () => {
                setGroupedCodes((prevBuckets) => {
                    if (prevBuckets.find((bucket) => bucket.name === 'Miscellaneous')) {
                        return prevBuckets.map((bucket) => {
                            if (bucket.name === 'Miscellaneous') {
                                return {
                                    ...bucket,
                                    codes: [...bucket.codes, ...unplacedSubCodes]
                                };
                            }
                            return bucket;
                        });
                    }
                    return [
                        ...prevBuckets,
                        {
                            id: (prevBuckets.length + 1).toString(),
                            name: 'Miscellaneous',
                            codes: unplacedSubCodes
                        }
                    ];
                });
                setUnplacedSubCodes([]);
            }
        );
    }, [unplacedSubCodes]);

    // Optionally add tutorial steps if needed
    const steps: TutorialStep[] = [
        {
            target: '#finalized-main',
            content: 'This is the finalizing codes page. Here you can review and edit your codes.',
            placement: 'bottom'
        },
        {
            target: '#review-edit-pill',
            content:
                'Click this button to toggle between review, where you can analyze the LLM generated codes and edit mode, where you can update the higher level codes formed from codes.',
            placement: 'bottom'
        },
        {
            target: '#finalized-code-table',
            content:
                'This table displays all the code responses. You can review the codes and their responses here.',
            placement: 'top'
        },
        {
            target: '#proceed-next-step',
            content: 'Step 4: Proceed to next step',
            placement: 'top'
        }
    ];

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
                {/* Toggle at the top (Review vs. Edit) */}
                {unplacedSubCodes.length > 0 && (
                    <p className="mb-4 text-red-500 text-center">
                        Go into edit mode, place unplaced codes into code buckets to proceed.
                    </p>
                )}
                <ReviewToggle review={review} setReview={setReview} />
                {/* <div className="flex-1 overflow-hidden"> */}
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
                <div className=" flex flex-col flex-1 overflow-hidden h-full">
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
                                        {/* Left Column: Buckets (70% width) */}
                                        <div
                                            className="w-[70%] flex-1 overflow-auto px-4"
                                            ref={codeRef}>
                                            <div className="grid grid-cols-2 gap-6">
                                                {groupedCodes.map((bucket) => (
                                                    <Bucket
                                                        scrollRef={codeRef}
                                                        key={bucket.id}
                                                        theme={bucket}
                                                        onDrop={handleDropToBucket}
                                                        onDelete={handleDeleteBucket}
                                                        setCodeRef={setCodeRef}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                        {/* Right Column: Unplaced Codes (30% width) */}
                                        <div className="flex flex-col h-full w-[30%] px-4 gap-2">
                                            <div className="flex-1 overflow-auto" ref={unplacedRef}>
                                                <UnplacedCodesBox
                                                    scrollRef={unplacedRef}
                                                    unplacedCodes={unplacedSubCodes}
                                                    onDrop={handleDropToUnplaced}
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
                                        onClick={() => {
                                            // if (checkIfDataExists(location.pathname)) {
                                            //     openModal('refresh-codes-submitted', async () => {
                                            //         await resetDataAfterPage(location.pathname);
                                            //         await handleRefreshCodes();
                                            //     });
                                            // } else {
                                            //     loadingDispatch({
                                            //         type: 'SET_REST_UNDONE',
                                            //         route: location.pathname
                                            //     });
                                            //     handleRefreshCodes();
                                            // }
                                            setIsFeedbackModalOpen(true);
                                        }}
                                        className="px-4 py-2 bg-gray-600 text-white rounded flex justify-center items-center gap-2">
                                        <DetailsLLMIcon className="h-6 w-6" />
                                        Redo grouping
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
                {/* </div> */}

                {/* Navigation at the bottom */}
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

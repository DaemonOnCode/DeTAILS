import { useCallback, useEffect, useRef, useState } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import Bucket from '../../components/Coding/Themes/bucket';
import UnplacedCodesBox from '../../components/Coding/Themes/unplaced-box';
import NavigationBottomBar from '../../components/Coding/Shared/navigation-bottom-bar';
import { LOADER_ROUTES, PAGE_ROUTES, ROUTES } from '../../constants/Coding/shared';
import { REMOTE_SERVER_ROUTES, ROUTES as SHARED_ROUTES } from '../../constants/Shared';
import { useCodingContext } from '../../context/coding-context';
import { useLogger } from '../../context/logging-context';
import { createTimer } from '../../utility/timer';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import { useLoadingContext } from '../../context/loading-context';
import { getCodingLoaderUrl } from '../../utility/get-loader-url';
import { useLocation, useNavigate } from 'react-router-dom';
import { TutorialStep } from '../../components/Shared/custom-tutorial-overlay';
import TutorialWrapper from '../../components/Shared/tutorial-wrapper';
import { DetailsLLMIcon } from '../../components/Shared/Icons';
import { useApi } from '../../hooks/Shared/use-api';
import { useSettings } from '../../context/settings-context';
import { useUndo } from '../../hooks/Shared/use-undo';
import useScrollRestoration from '../../hooks/Shared/use-scroll-restoration';

const ThemesPage = () => {
    const { themes, setThemes, unplacedCodes, setUnplacedCodes } = useCodingContext();
    const location = useLocation();
    const { performWithUndo } = useUndo();

    const { loadingState, openModal, resetDataAfterPage, checkIfDataExists, loadingDispatch } =
        useLoadingContext();
    const { settings } = useSettings();
    const navigate = useNavigate();
    const logger = useLogger();
    const { saveWorkspaceData } = useWorkspaceUtils();
    const hasSavedRef = useRef(false);

    const [searchQuery, setSearchQuery] = useState('');
    const [_, setNoResults] = useState(false);
    const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
    const [feedback, setFeedback] = useState('');
    const codeRefs = useRef<Map<string, HTMLDivElement>>(new Map());

    const setCodeRef = useCallback((code: string, node: HTMLDivElement | null) => {
        if (node) {
            codeRefs.current.set(code, node);
        } else {
            codeRefs.current.delete(code);
        }
    }, []);

    const handleSearch = () => {
        const trimmedQuery = searchQuery.trim().toLowerCase();
        const allCodes = [...themes.flatMap((theme) => theme.codes), ...unplacedCodes];
        const matchingCodes = allCodes.filter((code) => {
            const trimmedCode = code.trim().toLowerCase();
            return trimmedCode.includes(trimmedQuery);
        });

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
                        firstMatchElement = el;
                    }
                } else {
                    console.log('Element not found for code:', code);
                }
            });

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

    const handleFeedbackSubmit = async () => {
        setIsFeedbackModalOpen(false);
        if (await checkIfDataExists(location.pathname)) {
            openModal('refresh-themes-submitted', async () => {
                await resetDataAfterPage(location.pathname);
                await handleRefreshThemes(feedback);
            });
        } else {
            loadingDispatch({
                type: 'SET_REST_UNDONE',
                route: location.pathname
            });
            handleRefreshThemes(feedback);
        }
        setFeedback('');
    };

    const steps: TutorialStep[] = [
        {
            target: '#themes-header',
            content:
                'Welcome to the Themes and Codes Organizer. Here you can manage your themes and codes.',
            placement: 'bottom'
        },
        {
            target: '#add-theme-button',
            content: 'Click this button to add a new theme.',
            placement: 'right'
        },
        {
            target: '#bucket-section',
            content:
                'These are your theme buckets. Drag and drop codes into them to organize your data.',
            placement: 'top'
        },
        {
            target: '#unplaced-codes',
            content:
                'This section contains codes that are not assigned to any theme. Drag codes here to remove them from themes.',
            placement: 'top'
        },
        {
            target: '#refresh-themes-button',
            content: 'You can click on this to regenerate themes.',
            placement: 'top'
        },
        {
            target: '#proceed-next-step',
            content: 'Step 4: Proceed to next step',
            placement: 'top'
        }
    ];

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

    const { fetchLLMData } = useApi();

    const stepRoute = location.pathname;

    const { scrollRef: themeRef, storageKey: codeStorageKey } = useScrollRestoration('theme-list');

    useEffect(() => {
        if (themeRef.current && themes.length > 0) {
            const savedPosition = sessionStorage.getItem(codeStorageKey);
            if (savedPosition) {
                themeRef.current.scrollTop = parseInt(savedPosition, 10);
            }
        }
    }, [themes, themeRef, codeStorageKey]);

    const { scrollRef: unplacedRef, storageKey: unplacedStorageKey } =
        useScrollRestoration('unplaced-list');

    useEffect(() => {
        if (unplacedRef.current && unplacedCodes.length > 0) {
            const savedPosition = sessionStorage.getItem(unplacedStorageKey);
            if (savedPosition) {
                unplacedRef.current.scrollTop = parseInt(savedPosition, 10);
            }
        }
    }, [unplacedCodes, unplacedRef, unplacedStorageKey]);

    const handleDropToBucket = (themeId: string, code: string) => {
        performWithUndo([themes, unplacedCodes], [setThemes, setUnplacedCodes], () => {
            setThemes((prevThemes) =>
                prevThemes.map((theme) => {
                    if (theme.id === themeId) {
                        if (!theme.codes.includes(code)) {
                            return { ...theme, codes: [...theme.codes, code] };
                        }
                        return theme;
                    } else {
                        return { ...theme, codes: theme.codes.filter((c) => c !== code) };
                    }
                })
            );
            setUnplacedCodes((prevCodes) => prevCodes.filter((c) => c !== code));
        });
    };

    const handleDropToUnplaced = (code: string) => {
        performWithUndo([themes, unplacedCodes], [setThemes, setUnplacedCodes], () => {
            setUnplacedCodes((prevCodes) => {
                if (!prevCodes.includes(code)) {
                    return [...prevCodes, code];
                }
                return prevCodes;
            });
            setThemes((prevThemes) =>
                prevThemes.map((theme) => ({
                    ...theme,
                    codes: theme.codes.filter((c) => c !== code)
                }))
            );
        });
    };

    const handleAddTheme = () => {
        const newTheme = { id: (themes.length + 1).toString(), name: 'New Theme', codes: [] };
        setThemes((prevThemes) => [...prevThemes, newTheme]);
    };

    const handleDeleteTheme = (themeId: string) => {
        performWithUndo([themes, unplacedCodes], [setThemes, setUnplacedCodes], () => {
            const themeToDelete = themes.find((theme) => theme.id === themeId);
            if (themeToDelete) {
                setUnplacedCodes((prevCodes) => [...prevCodes, ...themeToDelete.codes]);
            }
            setThemes((prevThemes) => prevThemes.filter((theme) => theme.id !== themeId));
        });
    };

    const handleRefreshThemes = async (extraFeedback = '') => {
        loadingDispatch({
            type: 'SET_LOADING_ROUTE',
            route: PAGE_ROUTES.GENERATING_THEMES
        });
        navigate(getCodingLoaderUrl(LOADER_ROUTES.THEME_GENERATION_LOADER));

        const { data: results, error } = await fetchLLMData<{
            message: string;
        }>(REMOTE_SERVER_ROUTES.REDO_THEME_GENERATION, {
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
                    route: PAGE_ROUTES.GENERATING_THEMES
                });
            }
            return;
        }

        console.log('Results:', results);

        loadingDispatch({
            type: 'SET_LOADING_DONE_ROUTE',
            route: PAGE_ROUTES.GENERATING_THEMES
        });
        navigate(PAGE_ROUTES.GENERATING_THEMES);
    };

    const handleMoveToMiscellaneous = useCallback(() => {
        setThemes((prevBuckets) => {
            if (prevBuckets.find((bucket) => bucket.name === 'Miscellaneous')) {
                return prevBuckets.map((bucket) => {
                    if (bucket.name === 'Miscellaneous') {
                        return {
                            ...bucket,
                            codes: [...bucket.codes, ...unplacedCodes]
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
                    codes: unplacedCodes
                }
            ];
        });
        setUnplacedCodes([]);
    }, [unplacedCodes]);

    useEffect(() => {
        if (loadingState[stepRoute]?.isLoading) {
            navigate(getCodingLoaderUrl(LOADER_ROUTES.THEME_GENERATION_LOADER));
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
        <>
            <TutorialWrapper
                steps={steps}
                lastPage
                pageId={location.pathname}
                excludedTarget={`#route-/${SHARED_ROUTES.CODING}/${ROUTES.THEMATIC_ANALYSIS}`}>
                <div className="h-page flex flex-col">
                    <header id="themes-header" className="py-4">
                        <div className="flex justify-between items-center">
                            <h1 className="text-2xl font-bold">Themes and Codes Organizer</h1>
                            <input
                                type="text"
                                placeholder="Search codes..."
                                className="p-2 border rounded"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </header>
                    {unplacedCodes.length > 0 && (
                        <p className="text-red-500 pb-4 text-center">
                            Review the unplaced codes bucket at the end and ensure all codes are
                            assigned to some bucket before proceeding
                        </p>
                    )}
                    <main className="flex-1 overflow-hidden size-full">
                        <DndProvider backend={HTML5Backend} context={window}>
                            <div className="flex flex-1 overflow-hidden size-full">
                                {/* Left Column: Theme Buckets (70% width) */}
                                <div className="w-[70%] flex-1 overflow-auto px-4" ref={themeRef}>
                                    <div id="bucket-section" className="grid grid-cols-2 gap-6">
                                        {themes.map((theme) => (
                                            <Bucket
                                                scrollRef={themeRef}
                                                key={theme.id}
                                                theme={theme}
                                                onDrop={handleDropToBucket}
                                                onDelete={handleDeleteTheme}
                                                setCodeRef={setCodeRef}
                                            />
                                        ))}
                                    </div>
                                </div>
                                {/* Right Column: Unplaced Codes (30% width) */}
                                <div className="w-[30%] flex flex-col px-4 gap-2">
                                    <div
                                        className="flex-1 overflow-auto"
                                        id="unplaced-codes"
                                        ref={unplacedRef}>
                                        <UnplacedCodesBox
                                            scrollRef={unplacedRef}
                                            unplacedCodes={unplacedCodes}
                                            onDrop={handleDropToUnplaced}
                                            setCodeRef={setCodeRef}
                                        />
                                    </div>
                                    <div className="flex justify-center items-center">
                                        <button
                                            disabled={!unplacedCodes.length}
                                            className={`${unplacedCodes.length ? 'bg-blue-500 cursor-pointer' : 'bg-gray-500 cursor-not-allowed'} p-2 w-fit text-white rounded`}
                                            onClick={handleMoveToMiscellaneous}>
                                            Move rest to Miscellaneous
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </DndProvider>
                    </main>
                    <div className="pt-4 flex justify-between">
                        <button
                            id="add-theme-button"
                            onClick={handleAddTheme}
                            className="px-4 py-2 bg-blue-500 text-white rounded">
                            + Add New Theme
                        </button>
                        <button
                            id="refresh-themes-button"
                            onClick={() => {
                                setIsFeedbackModalOpen(true);
                            }}
                            className="px-4 py-2 bg-gray-600 text-white rounded flex justify-center items-center gap-2">
                            <DetailsLLMIcon className="h-6 w-6" />
                            Redo with feedback
                        </button>
                    </div>
                    <footer id="bottom-navigation">
                        <NavigationBottomBar
                            previousPage={PAGE_ROUTES.REVIEWING_CODES}
                            nextPage={PAGE_ROUTES.REPORT}
                            isReady={unplacedCodes.length === 0}
                        />
                    </footer>
                    {isFeedbackModalOpen && (
                        <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50">
                            <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
                                <h2 className="text-xl font-bold mb-4">
                                    Provide Feedback (Optional)
                                </h2>
                                <p className="mb-3">
                                    Please share any feedback on the current themes:
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
        </>
    );
};

export default ThemesPage;

import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import Bucket from '../../components/Coding/Themes/bucket';
import UnplacedCodesBox from '../../components/Coding/Themes/unplaced-box';
import NavigationBottomBar from '../../components/Coding/Shared/navigation-bottom-bar';
import { LOADER_ROUTES, ROUTES } from '../../constants/Coding/shared';
import { MODEL_LIST, REMOTE_SERVER_ROUTES, ROUTES as SHARED_ROUTES } from '../../constants/Shared';
import { useCodingContext } from '../../context/coding-context';
import { useLogger } from '../../context/logging-context';
import { createTimer } from '../../utility/timer';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import { useLoadingContext } from '../../context/loading-context';
import { getCodingLoaderUrl } from '../../utility/get-loader-url';
import { useLocation, useNavigate } from 'react-router-dom';
import CustomTutorialOverlay, {
    TutorialStep
} from '../../components/Shared/custom-tutorial-overlay';
import TutorialWrapper from '../../components/Shared/tutorial-wrapper';
import { DetailsLLMIcon, GeminiIcon } from '../../components/Shared/Icons';
import getServerUrl from '../../hooks/Shared/get-server-url';
import useServerUtils from '../../hooks/Shared/get-server-url';
import { useCollectionContext } from '../../context/collection-context';
import { StepHandle } from '../../types/Shared';
import { useApi } from '../../hooks/Shared/use-api';
import { useSettings } from '../../context/settings-context';
import { getGroupedCodeOfSubCode } from '../../utility/theme-finder';

const ThemesPage = () => {
    const {
        themes,
        setThemes,
        sampledPostResponse,
        unseenPostResponse,
        unplacedCodes,
        setUnplacedCodes,
        dispatchSampledPostWithThemeResponse,
        groupedCodes
    } = useCodingContext();
    const location = useLocation();

    const { loadingState, openModal, resetDataAfterPage, checkIfDataExists, loadingDispatch } =
        useLoadingContext();
    const { datasetId } = useCollectionContext();
    const { settings } = useSettings();
    const navigate = useNavigate();
    const logger = useLogger();
    const { saveWorkspaceData } = useWorkspaceUtils();
    const hasSavedRef = useRef(false);

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
                saveWorkspaceData();
                hasSavedRef.current = true;
            }
            logger.info('Themes Page Unloaded').then(() => {
                logger.time('Themes Page stay time', { time: timer.end() });
            });
        };
    }, []);

    const { fetchLLMData } = useApi();
    const { getServerUrl } = useServerUtils();

    const stepRoute = location.pathname;

    // useEffect(() => {
    //     registerStepRef(stepRoute, internalRef);
    // }, []);

    // // Expose the imperative methods for this step via the forwarded ref.
    // useImperativeHandle(loadingState[location.pathname].stepRef, () => ({
    //     validateStep: () => {
    //         // if (Object.keys(contextFiles).length === 0) {
    //         //     alert('Please add at least one context file.');
    //         //     return false;
    //         // }
    //         // if (mainTopic.trim() === '') {
    //         //     alert('Main topic is required.');
    //         //     return false;
    //         // }
    //         return true;
    //     },
    //     resetStep: () => {
    //         setThemes([]);
    //     }
    // }));

    // Handle drop into a specific theme
    const handleDropToBucket = (themeId: string, code: string) => {
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
    };

    // Handle dropping codes to the unplaced codes section
    const handleDropToUnplaced = (code: string) => {
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
    };

    const handleAddTheme = () => {
        const newTheme = { id: (themes.length + 1).toString(), name: 'New Theme', codes: [] };
        setThemes((prevThemes) => [...prevThemes, newTheme]);
    };

    const handleDeleteTheme = (themeId: string) => {
        const themeToDelete = themes.find((theme) => theme.id === themeId);
        if (themeToDelete) {
            setUnplacedCodes((prevCodes) => [...prevCodes, ...themeToDelete.codes]);
        }
        setThemes((prevThemes) => prevThemes.filter((theme) => theme.id !== themeId));
    };

    useEffect(() => {
        dispatchSampledPostWithThemeResponse({
            type: 'UPDATE_THEMES',
            themes: themes ?? []
        });
    }, [themes]);

    const handleRefreshThemes = async () => {
        loadingDispatch({
            type: 'SET_LOADING_ROUTE',
            route: `/${SHARED_ROUTES.CODING}/${ROUTES.THEMATIC_ANALYSIS}/${ROUTES.THEMES}`
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
                dataset_id: datasetId,
                model: settings.ai.model,
                unseen_post_responses: unseenPostResponse.map((r) => ({
                    postId: r.postId,
                    id: r.id,
                    code: getGroupedCodeOfSubCode(r.code, groupedCodes),
                    quote: r.quote,
                    explanation: r.explanation,
                    comment: r.comment,
                    subCode: r.code
                })),
                sampled_post_responses: sampledPostResponse.map((r) => ({
                    postId: r.postId,
                    id: r.id,
                    code: getGroupedCodeOfSubCode(r.code, groupedCodes),
                    quote: r.quote,
                    explanation: r.explanation,
                    comment: r.comment,
                    subCode: r.code
                }))
            })
        });

        if (error) {
            console.error('Error refreshing themes:', error);
            if (error.name !== 'AbortError') {
                loadingDispatch({
                    type: 'SET_LOADING_DONE_ROUTE',
                    route: `/${SHARED_ROUTES.CODING}/${ROUTES.THEMATIC_ANALYSIS}/${ROUTES.THEMES}`
                });
            }
            return;
        }

        console.log('Results:', results);

        setThemes(results.data.themes.map((theme: any) => ({ ...theme, name: theme.theme })));
        setUnplacedCodes(results.data.unplaced_codes);

        loadingDispatch({
            type: 'SET_LOADING_DONE_ROUTE',
            route: `/${SHARED_ROUTES.CODING}/${ROUTES.THEMATIC_ANALYSIS}/${ROUTES.THEMES}`
        });
        navigate(`/${SHARED_ROUTES.CODING}/${ROUTES.THEMATIC_ANALYSIS}/${ROUTES.THEMES}`);
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
                        <h1 className="text-2xl font-bold">Themes and Codes Organizer</h1>
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
                                <div className="w-[70%] flex-1 overflow-auto px-4">
                                    <div id="bucket-section" className="grid grid-cols-2 gap-6">
                                        {themes.map((theme) => (
                                            <Bucket
                                                key={theme.id}
                                                theme={theme}
                                                onDrop={handleDropToBucket}
                                                onDelete={handleDeleteTheme}
                                            />
                                        ))}
                                    </div>
                                </div>
                                {/* Right Column: Unplaced Codes (30% width) */}
                                <div className="w-[30%] flex flex-col px-4 gap-2">
                                    <div className="flex-1 overflow-auto" id="unplaced-codes">
                                        <UnplacedCodesBox
                                            unplacedCodes={unplacedCodes}
                                            onDrop={handleDropToUnplaced}
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
                                if (checkIfDataExists(location.pathname)) {
                                    openModal('refresh-themes-submitted', async () => {
                                        await resetDataAfterPage(location.pathname);
                                        await handleRefreshThemes();
                                    });
                                } else {
                                    loadingDispatch({
                                        type: 'SET_REST_UNDONE',
                                        route: location.pathname
                                    });
                                    handleRefreshThemes();
                                }
                            }}
                            className="px-4 py-2 bg-gray-600 text-white rounded flex justify-center items-center gap-2">
                            <DetailsLLMIcon className="h-6 w-6" />
                            Refresh Themes
                        </button>
                    </div>
                    <footer id="bottom-navigation">
                        <NavigationBottomBar
                            previousPage={`${ROUTES.DEDUCTIVE_CODING}`}
                            nextPage={`${ROUTES.THEMATIC_ANALYSIS}/${ROUTES.ANALYSIS}`}
                            isReady={unplacedCodes.length === 0}
                        />
                    </footer>
                </div>
            </TutorialWrapper>
        </>
    );
};

export default ThemesPage;

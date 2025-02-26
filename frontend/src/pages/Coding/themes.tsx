import { useEffect, useRef, useState } from 'react';
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
import { GeminiIcon } from '../../components/Shared/Icons';
import getServerUrl from '../../hooks/Shared/get-server-url';
import useServerUtils from '../../hooks/Shared/get-server-url';
import { useCollectionContext } from '../../context/collection-context';

const ThemesPage = () => {
    const {
        themes,
        setThemes,
        sampledPostResponse,
        unseenPostResponse,
        unplacedCodes,
        setUnplacedCodes,
        dispatchSampledPostWithThemeResponse
    } = useCodingContext();
    const location = useLocation();

    const { loadingState } = useLoadingContext();
    const { datasetId } = useCollectionContext();
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

    const { getServerUrl } = useServerUtils();

    useEffect(() => {
        if (loadingState[ROUTES.THEMES]) {
            navigate(getCodingLoaderUrl(LOADER_ROUTES.THEME_GENERATION_LOADER));
        }
    }, [loadingState]);

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
        navigate(getCodingLoaderUrl(LOADER_ROUTES.THEME_GENERATION_LOADER));

        const res = await fetch(getServerUrl(REMOTE_SERVER_ROUTES.THEME_GENERATION), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                dataset_id: datasetId,
                model: MODEL_LIST.GEMINI_FLASH,
                unseen_post_responses: unseenPostResponse,
                sampled_post_responses: sampledPostResponse
            })
        });

        const results: {
            message: string;
            data: any;
        } = await res.json();
        console.log('Results:', results);

        setThemes(results.data.themes.map((theme: any) => ({ ...theme, name: theme.theme })));
        setUnplacedCodes(results.data.unplaced_codes);

        navigate(`/${SHARED_ROUTES.CODING}/${ROUTES.THEMATIC_ANALYSIS}/${ROUTES.THEMES}`);
    };

    return (
        <>
            <TutorialWrapper
                steps={steps}
                lastPage
                pageId={location.pathname}
                excludedTarget={`#route-/${SHARED_ROUTES.CODING}/${ROUTES.THEMATIC_ANALYSIS}`}>
                <div className="h-page flex flex-col">
                    <header id="themes-header" className="py-4">
                        <h1 className="text-2xl font-bold mb-4">Themes and Codes Organizer</h1>
                    </header>
                    <main className="flex-1 overflow-auto pb-6">
                        <DndProvider backend={HTML5Backend} context={window}>
                            <div className="container mx-auto">
                                <div id="bucket-section" className="grid grid-cols-3 gap-6">
                                    {themes.map((theme) => (
                                        <Bucket
                                            key={theme.id}
                                            theme={theme}
                                            onDrop={handleDropToBucket}
                                            onDelete={handleDeleteTheme}
                                        />
                                    ))}
                                </div>
                                <div id="unplaced-codes">
                                    <UnplacedCodesBox
                                        unplacedCodes={unplacedCodes}
                                        onDrop={handleDropToUnplaced}
                                    />
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
                            onClick={handleRefreshThemes}
                            className="px-4 py-2 bg-blue-500 text-white rounded flex justify-center items-center gap-2">
                            <span className="h-6 w-6">
                                <GeminiIcon />
                            </span>
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

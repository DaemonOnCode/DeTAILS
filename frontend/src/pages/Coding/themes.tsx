import { useEffect, useRef, useState } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import Bucket from '../../components/Coding/Themes/bucket';
import UnplacedCodesBox from '../../components/Coding/Themes/unplaced-box';
import NavigationBottomBar from '../../components/Coding/Shared/navigation-bottom-bar';
import { LOADER_ROUTES, ROUTES } from '../../constants/Coding/shared';
import { useCodingContext } from '../../context/coding-context';
import { useLogger } from '../../context/logging-context';
import { createTimer } from '../../utility/timer';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import { useLoadingContext } from '../../context/loading-context';
import { getCodingLoaderUrl } from '../../utility/get-loader-url';
import { useNavigate } from 'react-router-dom';
import CustomTutorialOverlay, {
    TutorialStep
} from '../../components/Shared/custom-tutorial-overlay';

const ThemesPage = () => {
    const {
        themes,
        setThemes,
        unplacedCodes,
        setUnplacedCodes,
        dispatchSampledPostWithThemeResponse
    } = useCodingContext();

    const { loadingState } = useLoadingContext();
    const navigate = useNavigate();
    const logger = useLogger();
    const { saveWorkspaceData } = useWorkspaceUtils();
    const hasSavedRef = useRef(false);

    // Tutorial overlay state and steps
    const [runTutorial, setRunTutorial] = useState(false);
    const [tutorialFinished, setTutorialFinished] = useState(false);

    const tutorialSteps: TutorialStep[] = [
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

    return (
        <>
            {/* Tutorial overlay */}
            <CustomTutorialOverlay
                steps={tutorialSteps}
                run={runTutorial}
                onFinish={() => {
                    setRunTutorial(false);
                    setTutorialFinished(true);
                }}
            />

            {/* Tutorial prompt overlay */}
            {!tutorialFinished && !runTutorial && (
                <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black bg-opacity-70">
                    <div className="p-6 bg-white rounded shadow-lg text-center">
                        <p className="mb-4">Would you like to view the tutorial?</p>
                        <div className="flex justify-around">
                            <button
                                onClick={() => setRunTutorial(true)}
                                className="px-4 py-2 bg-blue-500 text-white rounded mr-2">
                                Show Tutorial
                            </button>
                            <button
                                onClick={() => setTutorialFinished(true)}
                                className="px-4 py-2 bg-gray-500 text-white rounded">
                                Skip Tutorial
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="h-page flex flex-col">
                <header id="themes-header" className="px-4 py-4">
                    <h1 className="text-2xl font-bold mb-4">Themes and Codes Organizer</h1>
                    <button
                        id="add-theme-button"
                        onClick={handleAddTheme}
                        className="mb-4 px-4 py-2 bg-blue-500 text-white rounded">
                        + Add New Theme
                    </button>
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

                <footer id="bottom-navigation">
                    <NavigationBottomBar
                        previousPage={`${ROUTES.DEDUCTIVE_CODING}`}
                        nextPage={`${ROUTES.THEMATIC_ANALYSIS}/${ROUTES.ANALYSIS}`}
                        isReady={unplacedCodes.length === 0}
                    />
                </footer>
            </div>
        </>
    );
};

export default ThemesPage;

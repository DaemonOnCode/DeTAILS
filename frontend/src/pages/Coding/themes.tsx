import { useEffect, useRef, useState } from 'react';
import { DndProvider, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { v4 as uuidv4 } from 'uuid';
import Bucket from '../../components/Coding/Themes/bucket';
import UnplacedCodesBox from '../../components/Coding/Themes/unplaced-box';
import NavigationBottomBar from '../../components/Coding/Shared/navigation-bottom-bar';
import { ROUTES } from '../../constants/Coding/shared';
import { useCodingContext } from '../../context/coding-context';
import { useLogger } from '../../context/logging-context';
import { createTimer } from '../../utility/timer';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';

const ThemesPage = () => {
    const {
        themes,
        setThemes,
        unplacedCodes,
        setUnplacedCodes,
        dispatchSampledPostWithThemeResponse
    } = useCodingContext();

    const logger = useLogger();
    const { saveWorkspaceData } = useWorkspaceUtils();

    const hasSavedRef = useRef(false);
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

    // Handle drop into a specific theme
    const handleDropToBucket = (themeId: string, code: string) => {
        setThemes((prevThemes) =>
            prevThemes.map((theme) =>
                theme.id === themeId
                    ? { ...theme, codes: [...theme.codes, code] }
                    : { ...theme, codes: theme.codes.filter((c) => c !== code) }
            )
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
        // console.log('sampledPostWithThemeResponse:', sampledPostResponse);
        // if (!sampledPostResponse) return;
        // if (themes.length === 0 && unplacedCodes.length === 0) {
        //     const themeSet = Array.from(
        //         new Set(sampledPostWithThemeResponse.map((data) => data.theme))
        //     ).filter(Boolean);
        //     setThemes(
        //         themeSet.map((theme, idx) => ({
        //             id: idx.toString(),
        //             name: theme,
        //             codes: sampledPostWithThemeResponse
        //                 .filter((data) => data.theme === theme)
        //                 .map((data) => data.code)
        //         }))
        //     );
        //     setUnplacedCodes(
        //         Array.from(
        //             new Set(
        //                 sampledPostWithThemeResponse
        //                     .map((data) => data.code)
        //                     .filter((code) => !themeSet.includes(code))
        //             )
        //         )
        //     );
        // }
    }, []);

    useEffect(() => {
        dispatchSampledPostWithThemeResponse({
            type: 'UPDATE_THEMES',
            themes: themes ?? []
        });
    }, [themes]);

    return (
        <div>
            <div className="max-h-maxPageContent h-maxPageContent">
                <DndProvider backend={HTML5Backend} context={window}>
                    <div className="container mx-auto">
                        <h1 className="text-2xl font-bold mb-4">Themes and Codes Organizer</h1>

                        <button
                            onClick={handleAddTheme}
                            className="mb-4 px-4 py-2 bg-blue-500 text-white rounded">
                            + Add New Theme
                        </button>

                        <div className="grid grid-cols-3 gap-6">
                            {themes.map((theme) => (
                                <Bucket
                                    key={theme.id}
                                    theme={theme}
                                    onDrop={handleDropToBucket}
                                    onDelete={handleDeleteTheme}
                                />
                            ))}
                        </div>

                        <UnplacedCodesBox
                            unplacedCodes={unplacedCodes}
                            onDrop={handleDropToUnplaced}
                        />
                    </div>
                </DndProvider>
            </div>
            <NavigationBottomBar
                previousPage={`${ROUTES.DEDUCTIVE_CODING}/${ROUTES.ENCODED_DATA}`}
                nextPage={ROUTES.FINAL}
                isReady={unplacedCodes.length === 0}
            />
        </div>
    );
};

export default ThemesPage;

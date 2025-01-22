import { useState } from 'react';
import { DndProvider, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { v4 as uuidv4 } from 'uuid';
import Bucket from '../../components/Coding/Themes/bucket';
import UnplacedCodesBox from '../../components/Coding/Themes/unplaced-box';
import NavigationBottomBar from '../../components/Coding/Shared/navigation_bottom_bar';
import { ROUTES } from '../../constants/Coding/shared';
import { useCodingContext } from '../../context/coding_context';

const ThemesPage = () => {
    const { sampledPostWithThemeData } = useCodingContext();

    const themeSet = new Set(sampledPostWithThemeData.map((data) => data.theme));

    const [themes, setThemes] = useState(
        Array.from(themeSet).map((theme) => ({
            id: uuidv4(),
            name: theme,
            codes: sampledPostWithThemeData
                .filter((data) => data.theme === theme)
                .map((data) => data.code)
        }))
    );

    const [unplacedCodes, setUnplacedCodes] = useState<string[]>([]);

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
        const newTheme = { id: uuidv4(), name: 'New Theme', codes: [] };
        setThemes((prevThemes) => [...prevThemes, newTheme]);
    };

    const handleDeleteTheme = (themeId: string) => {
        const themeToDelete = themes.find((theme) => theme.id === themeId);
        if (themeToDelete) {
            setUnplacedCodes((prevCodes) => [...prevCodes, ...themeToDelete.codes]);
        }
        setThemes((prevThemes) => prevThemes.filter((theme) => theme.id !== themeId));
    };

    return (
        <div>
            <div className="max-h-[calc(100vh-11rem)] h-[calc(100vh-11rem)]">
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
                previousPage={ROUTES.CODEBOOK_REFINEMENT}
                nextPage={ROUTES.FINAL_CODEBOOK}
                isReady={true}
            />
        </div>
    );
};

export default ThemesPage;

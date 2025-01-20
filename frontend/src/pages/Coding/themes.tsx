import { useState } from 'react';
import { DndProvider, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { v4 as uuidv4 } from 'uuid';
import Bucket from '../../components/Coding/Themes/bucket';
import CodeItem from '../../components/Coding/Themes/code-item';

const ThemesPage = () => {
    const [themes, setThemes] = useState([
        { id: uuidv4(), name: 'Technology', codes: ['AI', 'Blockchain', 'IoT'] },
        { id: uuidv4(), name: 'Science', codes: ['Biology', 'Physics'] }
    ]);

    const [unplacedCodes, setUnplacedCodes] = useState([
        'Psychology',
        'Quantum Computing',
        'Painting'
    ]);

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
        <DndProvider backend={HTML5Backend}>
            <div className="container mx-auto p-6">
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

                <UnplacedCodesBox unplacedCodes={unplacedCodes} onDrop={handleDropToUnplaced} />
            </div>
        </DndProvider>
    );
};

export default ThemesPage;

// Unplaced Codes Box Component
const UnplacedCodesBox = ({
    unplacedCodes,
    onDrop
}: {
    unplacedCodes: string[];
    onDrop: (code: string) => void;
}) => {
    const [{ isOver }, drop] = useDrop(() => ({
        accept: 'CODE',
        drop: (item: any) => {
            onDrop(item.code);
        },
        collect: (monitor) => ({
            isOver: !!monitor.isOver()
        })
    }));

    return (
        <div
            ref={drop}
            className={`mt-8 p-4 border border-dashed border-gray-500 rounded-lg bg-gray-50 ${
                isOver ? 'bg-yellow-100' : ''
            }`}
            style={{ minHeight: '100px' }}>
            <h2 className="text-xl font-semibold mb-4">Unplaced Codes</h2>
            <div className="flex gap-4 flex-wrap">
                {unplacedCodes.map((code) => (
                    <CodeItem key={code} code={code} />
                ))}
            </div>
        </div>
    );
};

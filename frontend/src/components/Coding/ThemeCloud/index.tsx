import { useState, useEffect, FC } from 'react';
import { IThemeBox } from '../../../types/Coding/shared';
import { ThemeCloudProps } from '../../../types/Coding/props';
import { FiEdit, FiTrash2 } from 'react-icons/fi'; // Import React Icons

const mainCodeFontSize = 20;
const otherThemeFontSize = 14;

function areThemesColliding(theme1: IThemeBox, theme2: IThemeBox, padding: number = 10) {
    return !(
        theme1.x + theme1.width + padding < theme2.x ||
        theme1.x > theme2.x + theme2.width + padding ||
        theme1.y + theme1.height + padding < theme2.y ||
        theme1.y > theme2.y + theme2.height + padding
    );
}

function placeTheme(themes: IThemeBox[], newTheme: IThemeBox, mainCodeBox: IThemeBox) {
    if (areThemesColliding(mainCodeBox, newTheme)) {
        return false;
    }

    for (let placedTheme of themes) {
        if (areThemesColliding(placedTheme, newTheme)) {
            return false; // Collision detected
        }
    }
    return true; // No collision
}

const measureTextWidth = (text: string, fontSize: number) => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (context) {
        context.font = `${fontSize}px Arial`;
        return context.measureText(text).width;
    }
    return 50;
};

const ThemeCloud: FC<ThemeCloudProps> = ({
    mainCode,
    themes,
    selectedThemes,
    toggleThemeSelection,
    setThemes
}) => {
    const [themesPlaced, setThemesPlaced] = useState<IThemeBox[]>([]);
    const [maxRadius, setMaxRadius] = useState(0);
    const [editingWord, setEditingWord] = useState<string | null>(null);
    const [newWord, setNewWord] = useState<string>('');
    const radiusIncrement = 50;

    const placeThemesAround = (): IThemeBox[] => {
        const placedThemes: IThemeBox[] = [];
        const mainCodeWidth = measureTextWidth(mainCode, mainCodeFontSize) + 30;
        const mainCodeHeight = mainCodeFontSize + 10;

        const mainCodeBox: IThemeBox = {
            text: mainCode,
            x: 0,
            y: 0,
            width: mainCodeWidth,
            height: mainCodeHeight
        };

        placedThemes.push(mainCodeBox);

        themes.forEach((theme, index) => {
            if (theme === mainCode) return;
            const textWidth = measureTextWidth(theme, otherThemeFontSize);
            const themeBox: IThemeBox = {
                text: theme,
                x: 0,
                y: 0,
                width: textWidth + 30,
                height: otherThemeFontSize + 10
            };

            let angle = (index * (2 * Math.PI)) / themes.length; // Spread themes evenly
            let radius = mainCodeWidth + 50;
            let placed = false;

            while (!placed) {
                const x = radius * Math.cos(angle);
                const y = radius * Math.sin(angle);
                themeBox.x = x;
                themeBox.y = y;

                if (placeTheme(placedThemes, themeBox, mainCodeBox)) {
                    if (themeBox.text === mainCode) continue;
                    placedThemes.push(themeBox);
                    placed = true;
                } else {
                    radius += radiusIncrement;
                    if (radius > 1000) {
                        console.warn(`Could not place theme: ${theme}`);
                        break;
                    }
                }
            }
        });
        return placedThemes;
    };

    useEffect(() => {
        const placedThemes = placeThemesAround();
        setThemesPlaced(placedThemes);

        const maxDistance = placedThemes.reduce((max, theme) => {
            const distance =
                Math.sqrt(theme.x ** 2 + theme.y ** 2) + Math.max(theme.width, theme.height) / 2;
            return Math.max(max, distance);
        }, 0);
        setMaxRadius(maxDistance + 40);
    }, [themes, selectedThemes]);

    const handleDelete = (theme: string) => {
        setThemes(themes.filter((t) => t !== theme));
    };

    const handleEdit = (theme: string) => {
        setEditingWord(theme);
        setNewWord(theme);
    };

    const saveEdit = () => {
        setThemes(themes.map((theme) => (theme === editingWord ? newWord : theme)));
        setEditingWord(null);
        setNewWord('');
    };

    return (
        <div
            className="relative bg-gray-100 rounded-full shadow-lg"
            style={{
                width: `${maxRadius * 2}px`,
                height: `${maxRadius * 2}px`,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
            }}>
            {editingWord && (
                <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50 z-50">
                    <div className="bg-white p-4 rounded shadow">
                        <h2>Edit Word</h2>
                        <input
                            value={newWord}
                            onChange={(e) => setNewWord(e.target.value)}
                            className="border p-2 rounded w-full"
                        />
                        <div className="flex justify-end mt-2">
                            <button
                                onClick={() => setEditingWord(null)}
                                className="px-4 py-2 bg-gray-300 rounded mr-2">
                                Cancel
                            </button>
                            <button
                                onClick={saveEdit}
                                className="px-4 py-2 bg-blue-500 text-white rounded">
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <svg
                width={maxRadius * 2}
                height={maxRadius * 2}
                viewBox={`-${maxRadius} -${maxRadius} ${maxRadius * 2} ${maxRadius * 2}`}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0
                }}>
                {themesPlaced.map((theme) => {
                    if (theme.text === mainCode) return null;

                    const themeX = theme.x;
                    const themeY = theme.y;

                    return (
                        <line
                            key={`line-${theme.text}`}
                            x1={0}
                            y1={0}
                            x2={themeX}
                            y2={themeY}
                            stroke="gray"
                            strokeWidth="1"
                        />
                    );
                })}
            </svg>

            {themesPlaced.map((theme) => (
                <div
                    key={theme.text}
                    className="absolute cursor-pointer group"
                    style={{
                        top: `${theme.y + maxRadius}px`,
                        left: `${theme.x + maxRadius}px`,
                        transform: 'translate(-50%, -50%)'
                    }}
                    onClick={() => toggleThemeSelection(theme.text)}>
                    <div
                        className={`px-3 py-1 rounded-lg ${
                            selectedThemes.includes(theme.text)
                                ? 'bg-blue-200 text-blue-700'
                                : 'bg-gray-200 text-gray-800'
                        } font-bold relative`}
                        style={{
                            fontSize:
                                theme.text === mainCode ? mainCodeFontSize : otherThemeFontSize
                        }}>
                        {theme.text}

                        {/* Hover Actions */}
                        {theme.text !== mainCode && (
                            <div className="absolute -top-2 -right-2 flex space-x-1 opacity-0 group-hover:opacity-100">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleEdit(theme.text);
                                    }}
                                    className="text-blue-600 hover:text-blue-800">
                                    <FiEdit />
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(theme.text);
                                    }}
                                    className="text-red-600 hover:text-red-800">
                                    <FiTrash2 />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ThemeCloud;

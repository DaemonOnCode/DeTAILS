import { createContext, useState, FC, useCallback, useMemo, useContext } from 'react';
import { ILayout } from '../types/Coding/shared';

const fs = window.require('fs');
const path = window.require('path');

export interface ISettingsConfig {
    general: {
        theme: 'light' | 'dark';
        language: string;
    };
    workspace: {
        layout: 'grid' | 'list';
    };
    devtools: {
        showConsole: boolean;
        enableRemoteDebugging: boolean;
    };
    tutorials: {
        showGlobal: boolean;
        skipPages: string[];
        hasRun: boolean;
    };
}

const defaultSettings: ISettingsConfig = {
    general: {
        theme: 'light',
        language: 'en'
    },
    workspace: {
        layout: 'grid'
    },
    devtools: {
        showConsole: false,
        enableRemoteDebugging: false
    },
    tutorials: {
        showGlobal: false,
        skipPages: [],
        hasRun: false
    }
};

export interface ISettingsContext {
    settings: ISettingsConfig;
    updateSettings: (
        section: keyof ISettingsConfig,
        updates: Partial<ISettingsConfig[typeof section]>
    ) => void;
    resetSettings: () => void;
    skipTutorialGlobally: () => void;
    skipTutorialForPage: (pageId: string) => void;
    showTutorialForPage: (pageId: string) => void;
}

export const SettingsContext = createContext<ISettingsContext>({
    settings: defaultSettings,
    updateSettings: () => {},
    resetSettings: () => {},
    skipTutorialGlobally: () => {},
    skipTutorialForPage: () => {},
    showTutorialForPage: () => {}
});

export const SettingsProvider: FC<ILayout> = ({ children }) => {
    const [settings, setSettings] = useState<ISettingsConfig>(defaultSettings);

    const writeSettingsToFile = useCallback((config: ISettingsConfig) => {
        console.log(__dirname, 'settings dirname');
        const filePath = path.join(__dirname, './settings.json');
        fs.writeFile(filePath, JSON.stringify(config, null, 2), (err: NodeJS.ErrnoException) => {
            if (err) {
                console.error('Error saving settings:', err);
            } else {
                console.log('Settings saved successfully!');
            }
        });
    }, []);

    const updateSettings = useCallback(
        (section: keyof ISettingsConfig, updates: Partial<ISettingsConfig[typeof section]>) => {
            setSettings((prevSettings) => {
                const newSettings = {
                    ...prevSettings,
                    [section]: {
                        ...prevSettings[section],
                        ...updates
                    }
                };
                writeSettingsToFile(newSettings);
                return newSettings;
            });
        },
        [writeSettingsToFile]
    );

    const resetSettings = useCallback(() => {
        setSettings(defaultSettings);
        writeSettingsToFile(defaultSettings);
    }, [writeSettingsToFile]);

    const skipTutorialGlobally = useCallback(() => {
        updateSettings('tutorials', { showGlobal: false });
    }, [updateSettings]);

    const skipTutorialForPage = useCallback(
        (pageId: string) => {
            updateSettings('tutorials', {
                skipPages: Array.from(new Set([...settings.tutorials.skipPages, pageId]))
            });
        },
        [settings.tutorials.skipPages, updateSettings]
    );

    const showTutorialForPage = useCallback(
        (pageId: string) => {
            updateSettings('tutorials', {
                skipPages: settings.tutorials.skipPages.filter((id) => id !== pageId)
            });
        },
        [settings.tutorials.skipPages, updateSettings]
    );

    const value = useMemo(
        () => ({
            settings,
            updateSettings,
            resetSettings,
            skipTutorialGlobally,
            skipTutorialForPage,
            showTutorialForPage
        }),
        [
            settings,
            updateSettings,
            resetSettings,
            skipTutorialGlobally,
            skipTutorialForPage,
            showTutorialForPage
        ]
    );

    return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = () => useContext(SettingsContext);

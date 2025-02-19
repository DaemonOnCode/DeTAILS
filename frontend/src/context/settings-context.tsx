// SettingsContext.tsx
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
    }
};

export interface ISettingsContext {
    settings: ISettingsConfig;
    updateSettings: (
        section: keyof ISettingsConfig,
        updates: Partial<ISettingsConfig[typeof section]>
    ) => void;
    resetSettings: () => void;
}

export const SettingsContext = createContext<ISettingsContext>({
    settings: defaultSettings,
    updateSettings: () => {},
    resetSettings: () => {}
});

export const SettingsProvider: FC<ILayout> = ({ children }) => {
    const [settings, setSettings] = useState<ISettingsConfig>(defaultSettings);

    const writeSettingsToFile = useCallback((config: ISettingsConfig) => {
        const filePath = path.join(__dirname, 'settings.json');
        fs.writeFile(filePath, JSON.stringify(config, null, 2), (err: NodeJS.ErrnoException) => {
            if (err) {
                console.error('Error saving settings:', err);
            } else {
                console.log('Settings saved successfully!');
            }
        });
    }, []);

    // Update a section of the settings config
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

    const value = useMemo(
        () => ({
            settings,
            updateSettings,
            resetSettings
        }),
        [settings, updateSettings, resetSettings]
    );

    return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = () => useContext(SettingsContext);

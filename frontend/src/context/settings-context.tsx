import { createContext, useState, FC, useCallback, useMemo, useContext, useEffect } from 'react';
import { ILayout } from '../types/Coding/shared';
import _defaultSettings from '../default-settings.json';

const { ipcRenderer } = window.require('electron');

export interface ISettingsConfig {
    app: {
        id: string;
    };
    general: {
        theme: 'light' | 'dark';
        language: string;
        manualCoding: boolean;
        keepSignedIn: boolean;
    };
    workspace: {
        layout: 'grid' | 'list';
    };
    ai: {
        model: string;
        googleCredentialsPath: string;
        temperature: number;
        randomSeed: number;
        modelList: string[];
        textEmbedding: string;
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
    transmission: {
        path: string;
        downloadDir: string;
    };
}

// Keep defaultSettings private.
const defaultSettings = _defaultSettings as ISettingsConfig;
type Sections = keyof Omit<ISettingsConfig, 'app'>;

export interface ISettingsContext {
    settings: ISettingsConfig;
    fetchSettings: () => Promise<void>;
    settingsLoading: boolean;
    updateSettings: (
        section: Sections,
        updates: Partial<ISettingsConfig[typeof section]>
    ) => Promise<void>;
    resetSettings: () => Promise<void>;
    resetSection: (section: Sections) => Promise<void>;
    skipTutorialGlobally: () => Promise<void>;
    skipTutorialForPage: (pageId: string) => Promise<void>;
    showTutorialForPage: (pageId: string) => Promise<void>;
    dirtySections: Record<Sections, boolean>;
    markSectionDirty: (section: Sections, isDirty: boolean) => void;
    disableBack: boolean;
    setDisableBack: (disable: boolean) => void;
}

export const SettingsContext = createContext<ISettingsContext>({
    settings: defaultSettings,
    fetchSettings: async () => {},
    settingsLoading: true,
    updateSettings: async () => {},
    resetSettings: async () => {},
    resetSection: async () => {},
    skipTutorialGlobally: async () => {},
    skipTutorialForPage: async () => {},
    showTutorialForPage: async () => {},
    dirtySections: Object.assign(
        {},
        ...Object.keys(defaultSettings).map((key) => ({ [key]: false }))
    ),
    markSectionDirty: () => {},
    disableBack: false,
    setDisableBack: () => {}
});

export const SettingsProvider: FC<ILayout> = ({ children }) => {
    const [settings, setSettings] = useState<ISettingsConfig>(defaultSettings);
    const [settingsLoading, setSettingsLoading] = useState<boolean>(false);
    const [dirtySections, setDirtySections] = useState<Record<Sections, boolean>>(
        Object.assign({}, ...Object.keys(defaultSettings).map((key) => ({ [key]: false })))
    );

    const [disableBack, setDisableBack] = useState<boolean>(false);

    const fetchSettings = async () => {
        setSettingsLoading(true);
        try {
            const savedSettings: ISettingsConfig = await ipcRenderer.invoke('get-settings');
            console.log('Settings:', savedSettings);
            if (savedSettings) {
                setSettings(savedSettings);
            }
        } catch (err) {
            console.error('Error retrieving settings:', err);
        } finally {
            setSettingsLoading(false);
        }
    };
    // Load settings on mount.
    useEffect(() => {
        fetchSettings();
    }, []);

    // Update a specific section of settings.
    const updateSettings = useCallback(
        async (section: Sections, updates: Partial<ISettingsConfig[typeof section]>) => {
            const newSettings = {
                ...settings,
                [section]: {
                    ...settings[section],
                    ...updates
                }
            };
            console.log('Updating settings:', newSettings);

            try {
                const updatedSettings: ISettingsConfig = await ipcRenderer.invoke(
                    'set-settings',
                    newSettings
                );

                console.log('Updated settings:', updatedSettings);
                setSettings(updatedSettings);
                // Once updated, clear the dirty flag for that section.
                setDirtySections((prev) => ({ ...prev, [section]: false }));
            } catch (err) {
                console.error('Error updating settings:', err);
            }
        },
        [settings]
    );

    // Reset the entire settings to defaults.
    const resetSettings = useCallback(async () => {
        try {
            const resetSettings: ISettingsConfig = await ipcRenderer.invoke('reset-settings');
            setSettings(resetSettings);
            // Clear all dirty flags.
            setDirtySections(
                Object.assign({}, ...Object.keys(defaultSettings).map((key) => ({ [key]: false })))
            );
        } catch (err) {
            console.error('Error resetting settings:', err);
        }
    }, []);

    // Reset an individual section to its default values.
    const resetSection = useCallback(
        async (section: Sections) => {
            try {
                await updateSettings(section, defaultSettings[section]);
                console.log(`Reset ${section} settings to default`);
            } catch (error) {
                console.error(`Error resetting ${section} settings:`, error);
            }
        },
        [updateSettings]
    );

    const skipTutorialGlobally = useCallback(async () => {
        await updateSettings('tutorials', { showGlobal: false });
    }, [settings.tutorials.showGlobal]);

    const skipTutorialForPage = useCallback(
        async (pageId: string) => {
            await updateSettings('tutorials', {
                skipPages: Array.from(new Set([...settings.tutorials.skipPages, pageId]))
            });
        },
        [settings.tutorials.skipPages, updateSettings]
    );

    const showTutorialForPage = useCallback(
        async (pageId: string) => {
            await updateSettings('tutorials', {
                skipPages: settings.tutorials.skipPages.filter((id) => id !== pageId)
            });
        },
        [settings.tutorials.skipPages, updateSettings]
    );

    // Helper to mark a section as having unsaved changes.
    const markSectionDirty = useCallback((section: Sections, isDirty: boolean) => {
        setDirtySections((prev) => ({ ...prev, [section]: isDirty }));
    }, []);

    const value = useMemo(
        () => ({
            settings,
            fetchSettings,
            settingsLoading,
            updateSettings,
            resetSettings,
            resetSection,
            skipTutorialGlobally,
            skipTutorialForPage,
            showTutorialForPage,
            dirtySections,
            markSectionDirty,
            disableBack,
            setDisableBack
        }),
        [settings, settingsLoading, dirtySections, disableBack]
    );

    return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = () => useContext(SettingsContext);

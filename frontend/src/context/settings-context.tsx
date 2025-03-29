import { createContext, useState, FC, useCallback, useMemo, useContext, useEffect } from 'react';
import { ILayout } from '../types/Coding/shared';
import _defaultSettings from '../default-settings.json';
import { toast } from 'react-toastify';
import { ProviderSettings } from '../types/Settings/shared';

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
        temperature: number;
        randomSeed: number;
        providers: Record<string, ProviderSettings>;
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
        magnetLink: string;
    };
}

const defaultSettings = _defaultSettings as unknown as ISettingsConfig;
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
    clearDirtySections: () => void;
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
    setDisableBack: () => {},
    clearDirtySections: () => {}
});

export const SettingsProvider: FC<ILayout> = ({ children }) => {
    const [settings, setSettings] = useState<ISettingsConfig>(defaultSettings);
    const [settingsLoading, setSettingsLoading] = useState<boolean>(false);
    const [settingsFetched, setSettingsFetched] = useState<boolean>(false); // New flag
    const [dirtySections, setDirtySections] = useState<Record<Sections, boolean>>(
        Object.assign({}, ...Object.keys(defaultSettings).map((key) => ({ [key]: false })))
    );
    const [disableBack, setDisableBack] = useState<boolean>(false);

    const fetchSettings = async () => {
        if (settingsFetched) return;

        setSettingsLoading(true);
        try {
            const savedSettings: ISettingsConfig = await ipcRenderer.invoke('get-settings');
            console.log('Settings:', savedSettings);
            if (savedSettings) {
                setSettings(savedSettings);
                setSettingsFetched(true);
            }
        } catch (err) {
            console.error('Error retrieving settings:', err);
        } finally {
            setSettingsLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    type ProviderSettings = ISettingsConfig['ai']['providers'][string];

    const updateAiSection = (
        currentAi: ISettingsConfig['ai'],
        updates: Partial<ISettingsConfig['ai']>
    ): ISettingsConfig['ai'] => {
        let newProviders = { ...currentAi.providers };
        if (updates.providers) {
            Object.entries(updates.providers).forEach(([provider, providerUpdates]) => {
                const existing = currentAi.providers[provider] || {};
                newProviders[provider] = {
                    ...existing,
                    ...providerUpdates
                } as ProviderSettings;
            });
        }
        return {
            ...currentAi,
            ...updates,
            providers: newProviders
        };
    };

    const updateSettings = useCallback(
        async (section: Sections, updates: Partial<ISettingsConfig[typeof section]>) => {
            let newSectionSettings;

            if (section === 'ai') {
                newSectionSettings = updateAiSection(
                    settings.ai,
                    updates as Partial<ISettingsConfig['ai']>
                );
            } else {
                newSectionSettings = {
                    ...settings[section],
                    ...updates
                };
            }

            const newSettings = {
                ...settings,
                [section]: newSectionSettings
            };

            try {
                const updatedSettings: ISettingsConfig = await ipcRenderer.invoke(
                    'set-settings',
                    newSettings
                );
                setSettings(updatedSettings);
                setDirtySections((prev) => ({ ...prev, [section]: false }));
            } catch (err) {
                console.error('Error updating settings:', err);
                toast.error('Error updating settings');
            }
        },
        [settings]
    );

    const resetSettings = useCallback(async () => {
        try {
            const resetSettings: ISettingsConfig = await ipcRenderer.invoke('reset-settings');
            setSettings(resetSettings);
            setDirtySections(
                Object.assign({}, ...Object.keys(defaultSettings).map((key) => ({ [key]: false })))
            );
        } catch (err) {
            console.error('Error resetting settings:', err);
        }
    }, []);

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
    }, [updateSettings]); // Fixed dependency

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

    const markSectionDirty = useCallback((section: Sections, isDirty: boolean) => {
        setDirtySections((prev) => ({ ...prev, [section]: isDirty }));
    }, []);

    const clearDirtySections = useCallback(() => {
        setDirtySections(
            Object.assign({}, ...Object.keys(defaultSettings).map((key) => ({ [key]: false })))
        );
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
            setDisableBack,
            clearDirtySections
        }),
        [settings, settingsLoading, dirtySections, disableBack]
    );

    return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = () => useContext(SettingsContext);

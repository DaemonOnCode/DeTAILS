const { app, ipcMain } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { findContextByName } = require('../utils/context');
const { electronLogger } = require('../utils/electron-logger');

// Path to the user settings file in the user data directory.
const settingsFilePath = path.join(app.getPath('userData'), 'settings.json');
electronLogger.log('Settings file path:', settingsFilePath);

// Path to the default settings file bundled with the app.
const defaultSettingsFilePath = path.join(__dirname, '..', '..', 'src', 'default-settings.json');

let defaultSettings;
try {
    defaultSettings = require(defaultSettingsFilePath);
} catch (error) {
    electronLogger.log('Could not load default settings:', error);
    defaultSettings = {};
}

const mergeSettings = (defaults, settings) => {
    const merged = {};
    for (const key in defaults) {
        if (Object.prototype.hasOwnProperty.call(defaults, key)) {
            if (typeof defaults[key] === 'object' && defaults[key] !== null) {
                merged[key] = { ...defaults[key], ...(settings[key] || {}) };
            } else {
                merged[key] = settings.hasOwnProperty(key) ? settings[key] : defaults[key];
            }
        }
    }
    for (const key in settings) {
        if (!merged.hasOwnProperty(key)) {
            merged[key] = settings[key];
        }
    }
    return merged;
};

const readSettings = async () => {
    try {
        const data = await fs.readFile(settingsFilePath, 'utf-8');
        let parsedSettings;
        try {
            parsedSettings = JSON.parse(data);
        } catch (jsonError) {
            electronLogger.error(
                'Malformed settings file. Overwriting with default settings.',
                jsonError
            );
            await fs.writeFile(settingsFilePath, JSON.stringify(defaultSettings, null, 2));
            return defaultSettings;
        }
        const mergedSettings = mergeSettings(defaultSettings, parsedSettings);

        if (mergedSettings.app && mergedSettings.app.id === '' && mergedSettings.app.id !== 'app') {
            mergedSettings.app.id = uuidv4();
            await fs.writeFile(settingsFilePath, JSON.stringify(mergedSettings, null, 2));
        }

        if (JSON.stringify(mergedSettings) !== JSON.stringify(parsedSettings)) {
            await fs.writeFile(settingsFilePath, JSON.stringify(mergedSettings, null, 2));
        }
        return mergedSettings;
    } catch (error) {
        electronLogger.error('Error reading settings:', error);
        if (error.code === 'ENOENT') {
            if (
                defaultSettings.app &&
                defaultSettings.app.id === '' &&
                defaultSettings.app.id !== 'app'
            ) {
                defaultSettings.app.id = uuidv4();
            }
            await fs.writeFile(settingsFilePath, JSON.stringify(defaultSettings, null, 2));
            return defaultSettings;
        }
        electronLogger.log('Error reading settings:', error);
        return defaultSettings;
    }
};

const writeSettings = async (settings, globalCtx) => {
    while (globalCtx.getState().isWriting) {
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
    globalCtx.setState({ isWriting: true });
    try {
        await fs.writeFile(settingsFilePath, JSON.stringify(settings, null, 2));
    } finally {
        globalCtx.setState({ isWriting: false });
    }
    return settings;
};

const settingsHandler = async (...ctxs) => {
    const globalCtx = findContextByName('global', ctxs);

    if (!globalCtx.getState().settings) {
        const settings = await readSettings();
        globalCtx.setState({ settings });
    }

    ipcMain.handle('get-settings', async () => {
        const settings = await readSettings();
        globalCtx.setState({ settings });
        return settings;
    });

    ipcMain.handle('set-settings', async (event, settings) => {
        const updatedSettings = await writeSettings(settings, globalCtx);
        globalCtx.setState({ settings: updatedSettings });
        return updatedSettings;
    });

    ipcMain.handle('reset-settings', async () => {
        const resetSettings = await writeSettings(defaultSettings, globalCtx);
        globalCtx.setState({ settings: resetSettings });
        return resetSettings;
    });
};

module.exports = { settingsHandler };

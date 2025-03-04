const { app, ipcMain } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { findContextByName } = require('../utils/context');
const { electronLogger } = require('../utils/electron-logger');

// Path to the user settings file in the user data directory.
const settingsFilePath = path.join(app.getPath('userData'), 'settings.json');
electronLogger.log('Settings file path:', settingsFilePath);

// Path to the default settings file bundled with your app.
const defaultSettingsFilePath = path.join(__dirname, '..', '..', 'src', 'default-settings.json');

// Load default settings from the default-settings.json file.
let defaultSettings;
try {
    // Synchronously load default settings.
    defaultSettings = require(defaultSettingsFilePath);
} catch (error) {
    console.error('Could not load default settings:', error);
    defaultSettings = {};
}

/**
 * Merges the default settings with the provided settings.
 * Any missing sections or keys from the defaults are added.
 * Extra keys in the provided settings are preserved.
 */
const mergeSettings = (defaults, settings) => {
    const merged = {};
    // Merge each section from defaults.
    for (const key in defaults) {
        if (Object.prototype.hasOwnProperty.call(defaults, key)) {
            if (typeof defaults[key] === 'object' && defaults[key] !== null) {
                merged[key] = { ...defaults[key], ...(settings[key] || {}) };
            } else {
                merged[key] = settings.hasOwnProperty(key) ? settings[key] : defaults[key];
            }
        }
    }
    // Preserve any extra keys in settings that are not in defaults.
    for (const key in settings) {
        if (!merged.hasOwnProperty(key)) {
            merged[key] = settings[key];
        }
    }
    return merged;
};

// Function to read settings from disk.
// If the file does not exist or is malformed, it creates one using defaultSettings (merging missing sections).
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
        // Merge parsed settings with defaults to ensure all sections/keys exist.
        const mergedSettings = mergeSettings(defaultSettings, parsedSettings);

        // Check if app.id is an empty string. If so, update it with a new uuid.
        if (mergedSettings.app && mergedSettings.app.id === '' && mergedSettings.app.id !== 'app') {
            mergedSettings.app.id = uuidv4();
            await fs.writeFile(settingsFilePath, JSON.stringify(mergedSettings, null, 2));
        }

        // If merging changed the settings, update the file.
        if (JSON.stringify(mergedSettings) !== JSON.stringify(parsedSettings)) {
            await fs.writeFile(settingsFilePath, JSON.stringify(mergedSettings, null, 2));
        }
        return mergedSettings;
    } catch (error) {
        if (error.code === 'ENOENT') {
            // File doesn't exist; create it from default settings.
            // Check and update the app id if necessary.
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
        // For other errors, log and return default settings.
        console.error('Error reading settings:', error);
        return defaultSettings;
    }
};

// Function to write settings to disk with a lock managed via the global context.
const writeSettings = async (settings, globalCtx) => {
    // Wait until any ongoing write is finished.
    while (globalCtx.getState().isWriting) {
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
    // Set the lock flag in the global context.
    globalCtx.setState({ isWriting: true });
    try {
        await fs.writeFile(settingsFilePath, JSON.stringify(settings, null, 2));
    } finally {
        // Clear the lock flag.
        globalCtx.setState({ isWriting: false });
    }
    return settings;
};

// Custom settings handler that sets up IPC listeners.
const settingsHandler = async (...ctxs) => {
    const globalCtx = findContextByName('global', ctxs);

    // Initialize global context settings if not already set.
    if (!globalCtx.getState().settings) {
        const settings = await readSettings();
        globalCtx.setState({ settings });
    }

    // IPC handler for reading settings.
    ipcMain.handle('get-settings', async () => {
        const settings = await readSettings();
        // Update the global context state with the latest settings.
        globalCtx.setState({ settings });
        return settings;
    });

    // IPC handler for updating settings.
    ipcMain.handle('set-settings', async (event, settings) => {
        const updatedSettings = await writeSettings(settings, globalCtx);
        // Update the global context state.
        globalCtx.setState({ settings: updatedSettings });
        return updatedSettings;
    });

    // IPC handler to reset settings to the default.
    ipcMain.handle('reset-settings', async () => {
        const resetSettings = await writeSettings(defaultSettings, globalCtx);
        // Update the global context state.
        globalCtx.setState({ settings: resetSettings });
        return resetSettings;
    });
};

module.exports = { settingsHandler };

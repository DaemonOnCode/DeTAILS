const { app, BrowserWindow, ipcMain, Menu, dialog, session } = require('electron');
const { autoUpdater } = require('electron-updater');
const AutoLaunch = require('auto-launch');
const remote = require('@electron/remote/main');
const { createMainWindow } = require('./utils/create-main-window');
const config = require('./utils/global-state');
const registerIpcHandlers = require('./handles');
const logger = require('./utils/logger');
const { spawnedProcesses } = require('./utils/spawn-services');
const { createMenu } = require('./utils/menu');
const { createContext } = require('./utils/context');
const { electronLogger } = require('./utils/electron-logger');

const newConfig = require('../src/config')('electron');

electronLogger.log(newConfig);

// Enable auto-reloading in development mode
if (process.env.NODE_ENV === 'development') {
    require('electron-reloader')(module, {
        ignore: [/\.db$/]
    });
}

// Initialize Electron remote
remote.initialize();

// Configure auto-launch for production mode
if (!process.env.NODE_ENV === 'development') {
    const autoStart = new AutoLaunch({
        name: config.appName
    });
    autoStart.enable();
}

// Function to clean up and gracefully exit
const cleanupAndExit = async (signal) => {
    electronLogger.log(`Received signal: ${signal}`);
    await logger.info('Process exited', { signal });
    for (const { name, process } of spawnedProcesses) {
        electronLogger.log(`Terminating process: ${name}`);
        try {
            process.kill(); // Sends SIGTERM to the process
        } catch (err) {
            console.error(`Error terminating process ${name}:`, err);
        }
    }
    try {
        config.websocket.close();
    } catch (e) {
        electronLogger.log('Error closing websocket');
    }
    // Perform cleanup tasks here if needed
    app.quit();
};

// Wait for the app to be ready
app.whenReady().then(async () => {
    let globalCtx = createContext('global', {
        ...config
    });

    createMenu(globalCtx);

    logger.info('Electron app is ready');

    // Create the main application window
    globalCtx.setState({ mainWindow: await createMainWindow(globalCtx) });

    // Log system and process metrics
    logger.logSystemAndProcessMetrics();

    // // Listen for renderer events to send messages via WebSocket
    // ipcMain.on('send-ws-message', (event, message) => {
    //     if (ws.readyState === WebSocket.OPEN) {
    //         ws.send(message);
    //     }
    // });

    // Register signal handlers for SIGINT, SIGTERM, and SIGABRT
    ['SIGINT', 'SIGTERM', 'SIGABRT', 'SIGHUP'].forEach((signal) => {
        electronLogger.log(`Registering handler for signal: ${signal}`);
        process.on(signal, () => {
            electronLogger.log(`Handler triggered for signal: ${signal}`);
            cleanupAndExit(signal);
        });
    });

    // Handle app activation (specific to macOS)
    app.on('activate', async () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            globalCtx.getState().mainWindow = await createMainWindow();
        }
    });

    // IPC listener for app version
    ipcMain.on('app_version', (event) => {
        event.sender.send('app_version', { version: app.getVersion() });
    });

    // AutoUpdater events
    if (process.env.NODE_ENV === 'development') {
        autoUpdater.on('update-available', () => {
            logger.info('Update available');
            globalCtx.getState().mainWindow.webContents.send('update_available');
        });

        autoUpdater.on('update-downloaded', () => {
            logger.info('Update downloaded');
            globalCtx.getState().mainWindow.webContents.send('update_downloaded');
        });
    }

    // app.on('web-contents-created', (event, contents) => {
    //     contents.session.webRequest.onHeadersReceived((details, callback) => {
    //         callback({
    //             responseHeaders: {
    //                 ...details.responseHeaders,
    //                 'Content-Security-Policy': ["default-src 'self' ws://localhost:8080"]
    //             }
    //         });
    //     });
    // });

    // IPC listener for restarting the app to install updates
    ipcMain.on('restart_app', () => {
        logger.info('Restarting app to install updates');
        autoUpdater.quitAndInstall();
    });

    app.on('before-quit', async () => {
        const ses = session.defaultSession;
        try {
            await ses.clearStorageData({ storages: ['localstorage'] });
            electronLogger.log('LocalStorage cleared via session API.');
        } catch (err) {
            console.error('Error clearing localStorage via session API:', err);
        }
    });

    // Register other IPC handlers
    registerIpcHandlers(globalCtx);
});

// Handle all windows being closed
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        cleanupAndExit();
    }
});

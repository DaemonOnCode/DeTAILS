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
const cleanupAndExit = async (globalCtx, signal) => {
    electronLogger.log('Cleaning up and exiting...');
    electronLogger.log('Clearing localStorage via session API...');
    const ses = session.defaultSession;
    try {
        await ses.clearStorageData({ storages: ['localstorage'] });
        electronLogger.log('LocalStorage cleared via session API.');
    } catch (err) {
        electronLogger.error('Error clearing localStorage via session API:', err);
    }

    electronLogger.log(`Received signal: ${signal}`);
    await logger.info('Process exited', { signal });
    electronLogger.log('Closing spawned processes...', spawnedProcesses);
    for (const { name, process } of spawnedProcesses) {
        electronLogger.log(`Terminating process: ${name}`);
        try {
            process.kill(); // Sends SIGTERM to the process
        } catch (err) {
            electronLogger.error(`Error terminating process ${name}:`, err);
        }
    }
    try {
        globalCtx.getState().websocket.close();
        globalCtx.setState({ websocket: null });
    } catch (e) {
        electronLogger.log('Error closing websocket');
    }
    // Perform cleanup tasks here if needed
    if (!signal) {
        // app.exit();
        return;
    }
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

    // Register signal handlers
    ['SIGINT', 'SIGTERM', 'SIGABRT', 'SIGHUP', 'SIGSEGV'].forEach((signal) => {
        electronLogger.log(`Registering handler for signal: ${signal}`);
        process.on(signal, () => {
            electronLogger.log(`Handler triggered for signal: ${signal}`);
            cleanupAndExit(globalCtx, signal);
        });
    });

    // Handle app activation (specific to macOS)
    app.on('activate', async () => {
        // if (BrowserWindow.getAllWindows().length === 0) {
        //     globalCtx.getState().mainWindow = await createMainWindow();
        // }
        if (globalCtx.getState().mainWindow) {
            globalCtx.getState().mainWindow.show();
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

    ipcMain.on('close', (event) => {
        electronLogger.log('closed app with x');
    });

    app.on('before-quit', async () => {
        electronLogger.log('before-quit');
        // cleanupAndExit(globalCtx);
        globalCtx.setState({ isQuitting: true });
    });

    app.on('will-quit', (event) => {
        electronLogger.log('will-quit event triggered');
        // cleanupAndExit(globalCtx);
    });

    app.on('quit', async (event, exitCode) => {
        console.log('quit event triggered', 'cleaning up and exiting');
        await cleanupAndExit(globalCtx);

        electronLogger.log(`App is quitting with exit code: ${exitCode}`);

        app.exit(exitCode);
    });

    // Register other IPC handlers
    registerIpcHandlers(globalCtx);
});

app.on('window-all-closed', () => {
    console.log('window-all-closed');
    // if (process.platform !== 'darwin') {
    //     cleanupAndExit(globalCtx);
    // } else {
    //     // globalCtx.getState().mainWindow.hide();
    //     // try {
    //     //     globalCtx.getState().websocket.close();
    //     //     globalCtx.setState({ websocket: null });
    //     // } catch (e) {
    //     //     electronLogger.log('Error closing websocket', e);
    //     // }
    // }
});

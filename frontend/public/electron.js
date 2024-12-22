const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const { createMainWindow } = require('./utils/createMainWindow');
const AutoLaunch = require('auto-launch');
const remote = require('@electron/remote/main');
const config = require('./utils/config');
const registerIpcHandlers = require('./handles');
const logger = require('./utils/logger');
const { spawnedProcesses } = require('./utils/spawn-services');
const { createMenu } = require('./utils/menu');

// Enable auto-reloading in development mode
if (config.isDev) {
    require('electron-reloader')(module, {
        ignore: [/\.db$/]
    });
}

// Initialize Electron remote
remote.initialize();

// Configure auto-launch for production mode
if (!config.isDev) {
    const autoStart = new AutoLaunch({
        name: config.appName
    });
    autoStart.enable();
}

// Function to clean up and gracefully exit
const cleanupAndExit = async (signal) => {
    console.log(`Received signal: ${signal}`);
    await logger.info('Process exited', { signal });
    for (const { name, process } of spawnedProcesses) {
        console.log(`Terminating process: ${name}`);
        try {
            process.kill(); // Sends SIGTERM to the process
        } catch (err) {
            console.error(`Error terminating process ${name}:`, err);
        }
    }
    try {
        config.websocket.close();
    } catch (e) {
        console.log('Error closing websocket');
    }
    // Perform cleanup tasks here if needed
    app.quit();
};

// Wait for the app to be ready
app.whenReady().then(async () => {
    createMenu();

    logger.info('Electron app is ready');

    // Create the main application window
    config.mainWindow = await createMainWindow();

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
        console.log(`Registering handler for signal: ${signal}`);
        process.on(signal, () => {
            console.log(`Handler triggered for signal: ${signal}`);
            cleanupAndExit(signal);
        });
    });

    // Handle app activation (specific to macOS)
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            config.mainWindow = createMainWindow();
        }
    });

    // IPC listener for app version
    ipcMain.on('app_version', (event) => {
        event.sender.send('app_version', { version: app.getVersion() });
    });

    // AutoUpdater events
    autoUpdater.on('update-available', () => {
        logger.info('Update available');
        config.mainWindow.webContents.send('update_available');
    });

    autoUpdater.on('update-downloaded', () => {
        logger.info('Update downloaded');
        config.mainWindow.webContents.send('update_downloaded');
    });

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

    // Register other IPC handlers
    registerIpcHandlers();
});

// Handle all windows being closed
app.on('window-all-closed', () => {
    // if (process.platform !== 'darwin') {
    app.quit();
    // }
});

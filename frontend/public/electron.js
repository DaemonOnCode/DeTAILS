const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const { createMainWindow } = require('./utils/createMainWindow');
const AutoLaunch = require('auto-launch');
const remote = require('@electron/remote/main');
const config = require('./utils/config');
const registerIpcHandlers = require('./handles');
const logger = require('./utils/logger');
const WebSocket = require('ws');

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
    try {
        config.websocket.close();
    } catch (e) {
        console.log('Error closing websocket');
    }
    // Perform cleanup tasks here if needed
    app.quit();
};

const menuTemplate = [
    {
        label: 'File',
        submenu: [
            {
                label: 'New File',
                accelerator: 'CmdOrCtrl+N',
                click: () => console.log('New File')
            },
            {
                label: 'Open File',
                accelerator: 'CmdOrCtrl+O',
                click: () => console.log('Open File')
            },
            { type: 'separator' },
            {
                label: 'Save workspace',
                accelerator: 'CmdOrCtrl+S',
                click: async () => {
                    config.mainWindow.webContents.send('menu-save-workspace');
                }
            },
            {
                label: 'Import workspace',
                accelerator: 'CmdOrCtrl+I',
                click: async () => {
                    const { canceled, filePaths } = await dialog.showOpenDialog({
                        properties: ['openFile'],
                        filters: [{ name: 'ZIP', extensions: ['zip'] }]
                    });
                    if (!canceled && filePaths.length > 0) {
                        // const data = fs.readFileSync(filePaths[0], 'utf-8');
                        config.mainWindow.webContents.send('menu-import-workspace', filePaths[0]);
                    }
                }
            },
            {
                label: 'Export workspace',
                accelerator: 'CmdOrCtrl+E',
                click: async () => {
                    // const { canceled, filePath } = await dialog.showSaveDialog({
                    //     title: 'Export Workspace',
                    //     defaultPath: 'workspace.json',
                    //     filters: [{ name: 'JSON', extensions: ['json'] }]
                    // });
                    // console.log('Exporting workspace to:', filePath);
                    // if (!canceled && filePath) {
                    config.mainWindow.webContents.send('menu-export-workspace');
                    // }
                }
            },
            { type: 'separator' },
            { label: 'Exit', role: 'quit' }
        ]
    },
    {
        label: 'Edit',
        submenu: [
            { role: 'undo' },
            { role: 'redo' },
            { type: 'separator' },
            { role: 'cut' },
            { role: 'copy' },
            { role: 'paste' },
            { role: 'selectAll' }
        ]
    },
    {
        label: 'View',
        submenu: [
            { label: 'Reload', role: 'reload' },
            { label: 'Toggle Developer Tools', role: 'toggleDevTools' }
        ]
    },
    {
        label: 'Help',
        submenu: [{ label: 'About', click: () => console.log('About clicked') }]
    }
];

// Wait for the app to be ready
app.whenReady().then(async () => {
    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);

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

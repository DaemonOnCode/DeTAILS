const { app, ipcMain, session } = require('electron');

if (require('electron-squirrel-startup')) app.quit();

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
const { killProcess } = require('./utils/kill-process');

const newConfig = require('../src/config')('electron');

electronLogger.log(newConfig);

if (process.env.NODE_ENV === 'development') {
    require('electron-reloader')(module, {
        ignore: [/\.db$/]
    });
}

remote.initialize();

if (!process.env.NODE_ENV === 'development') {
    const autoStart = new AutoLaunch({
        name: config.appName
    });
    autoStart.enable();
}

const cleanupAndExit = async (globalCtx, signal) => {
    electronLogger.log('Cleaning up and exiting...');
    if (!globalCtx.getState().settings.general.keepSignedIn) {
        electronLogger.log('Clearing localStorage via session API...');
        const ses = session.defaultSession;
        try {
            await ses.clearStorageData({ storages: ['localstorage'] });
            electronLogger.log('LocalStorage cleared via session API.');
        } catch (err) {
            electronLogger.error('Error clearing localStorage via session API:', err);
        }
    }

    electronLogger.log(`Received signal: ${signal}`);
    await logger.info('Process exited', { signal });
    for (const { name, process: child } of spawnedProcesses) {
        electronLogger.log(`Terminating process: ${name}`);
        killProcess(child);
    }
    try {
        globalCtx.getState().websocket.close();
        globalCtx.setState({ websocket: null });
    } catch (e) {
        electronLogger.log('Error closing websocket');
    }

    if (!signal) {
        app.exit();
        return;
    }
    app.exit();
};

app.commandLine.appendSwitch('force-color-profile', 'srgb');

app.whenReady().then(async () => {
    let globalCtx = createContext('global', {
        ...config
    });

    createMenu(globalCtx);

    logger.info('Electron app is ready');

    // Register other IPC handlers
    registerIpcHandlers(globalCtx);

    // Create the main application window
    globalCtx.setState({ mainWindow: await createMainWindow(globalCtx) });

    // Log system and process metrics
    logger.logSystemAndProcessMetrics();

    // Register signal handlers
    ['SIGINT', 'SIGTERM', 'SIGABRT', 'SIGHUP', 'SIGSEGV'].forEach((signal) => {
        electronLogger.log(`Registering handler for signal: ${signal}`);
        process.on(signal, async () => {
            electronLogger.log(`Handler triggered for signal: ${signal}`);
            await cleanupAndExit(globalCtx, signal);
        });
    });

    // Handle app activation (specific to macOS)
    app.on('activate', async () => {
        if (globalCtx.getState().mainWindow) {
            globalCtx.getState().mainWindow.show();
        }
    });

    ipcMain.on('app_version', (event) => {
        event.sender.send('app_version', { version: app.getVersion() });
    });

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

    ipcMain.on('restart_app', () => {
        logger.info('Restarting app to install updates');
        autoUpdater.quitAndInstall();
    });

    ipcMain.on('close', (event) => {
        electronLogger.log('closed app with x');
    });

    app.on('before-quit', async (event) => {
        event.preventDefault();
        electronLogger.log('before-quit');
        await cleanupAndExit(globalCtx);
        globalCtx.setState({ isQuitting: true });
    });

    app.on('will-quit', (event) => {
        electronLogger.log('will-quit event triggered');
    });

    app.on('quit', async (event, exitCode) => {
        console.log('quit event triggered', 'cleaning up and exiting');

        electronLogger.log(`App is quitting with exit code: ${exitCode}`);

        app.exit(exitCode);
    });

    app.on('window-all-closed', () => {
        console.log('window-all-closed');
        if (process.platform !== 'darwin') {
            cleanupAndExit(globalCtx);
        }
    });
});

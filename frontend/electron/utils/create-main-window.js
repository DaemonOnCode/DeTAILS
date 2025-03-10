const { app, BrowserWindow, ipcMain, dialog, nativeImage } = require('electron');
const { join } = require('path');
const { autoUpdater } = require('electron-updater');
const remote = require('@electron/remote/main');
const globalState = require('./global-state');
const { electronLogger } = require('./electron-logger');
const { createExpressServer } = require('./express-helper');

function getPlatformIcon() {
    switch (process.platform) {
        case 'win32':
            return join(__dirname, '..', '..', 'public', 'favicon.ico');
        case 'darwin':
            return join(__dirname, '..', '..', 'public', 'details-dock-icon.icns');
        case 'linux':
            return join(__dirname, '..', '..', 'public', 'details-dock-icon.png');
        default:
            return join(__dirname, '..', '..', 'public', 'details-dock-icon.png');
    }
}

exports.createMainWindow = async (...ctxs) => {
    const globalCtx = ctxs.find((ctx) => ctx.name === 'global');

    const window = new BrowserWindow({
        width: 800,
        height: 600,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            nodeIntegration: true,
            enableRemoteModule: true,
            devTools: false, //process.env.NODE_ENV !== 'production',
            contextIsolation: false,
            webSecurity: false,
            nodeIntegrationInWorker: true
            // sandbox: false
        },
        icon: getPlatformIcon(),
        title: globalState.appName
    });

    if (process.platform === 'darwin' && process.env.NODE_ENV === 'development') {
        const dockIcon = nativeImage.createFromPath(
            join(__dirname, '..', '..', 'public', 'final', 'details-dock-icon.png')
        );
        app.dock.setIcon(dockIcon);
    }

    remote.enable(window.webContents);

    electronLogger.log('Loading URL:', process.env.REACT_APP_URL, process.env.NODE_ENV);

    if (process.env.NODE_ENV !== 'development') {
        createExpressServer();
    }

    console.time('webloader');

    await window.loadURL(
        process.env.REACT_APP_URL ??
            (process.env.NODE_ENV === 'development'
                ? 'http://localhost:3000'
                : `file://${join(__dirname, '..', '..', './build/index.html')}`)
    );
    console.timeEnd('webloader');

    window.once('ready-to-show', () => {
        if (process.env.NODE_ENV !== 'development') {
            return;
        }
        autoUpdater.checkForUpdatesAndNotify();
    });

    window.on('close', (e) => {
        console.log('close event');
        if (process.platform === 'darwin' && !globalCtx.getState().isQuitting) {
            e.preventDefault(); // Prevent close on macOS
            if (window.isFullScreen()) {
                window.once('leave-full-screen', () => window.hide());
                window.setFullScreen(false);
                window.once('show', () => window.setFullScreen(true)); // when it's time to show the window again, some code will call window.show() and trigger this
            } else {
                window.hide();
            }
            // window.minimize();
        }
    });

    return window;
};

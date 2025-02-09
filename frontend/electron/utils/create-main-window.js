const { app, BrowserWindow, ipcMain, dialog, nativeImage } = require('electron');
const { join } = require('path');
const { autoUpdater } = require('electron-updater');
const remote = require('@electron/remote/main');
const globalState = require('./global-state');

function getPlatformIcon() {
    switch (process.platform) {
        case 'win32':
            return join(__dirname, '..', '..', 'public', 'favicon.ico');
        case 'darwin':
            return join(__dirname, '..', '..', 'public', 'acqa-icon.icns');
        case 'linux':
            return join(__dirname, '..', '..', 'public', 'android-chrome-512x512.png');
        default:
            return join(__dirname, '..', '..', 'public', 'android-chrome-512x512.png');
    }
}

exports.createMainWindow = async (...ctxs) => {
    const window = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            enableRemoteModule: true,
            devTools: process.env.NODE_ENV !== 'production',
            contextIsolation: false,
            webSecurity: false,
            nodeIntegrationInWorker: true
            // sandbox: false
        },
        icon: getPlatformIcon(),
        title: globalState.appName
    });

    if (process.platform === 'darwin') {
        const dockIcon = nativeImage.createFromPath(
            join(__dirname, '..', '..', 'public', 'acqa-icon.icns')
        );
        app.dock.setIcon(dockIcon);
    }

    remote.enable(window.webContents);

    console.log('Loading URL:', process.env.REACT_APP_URL, process.env.NODE_ENV);
    await window.loadURL(
        process.env.REACT_APP_URL ||
            (process.env.NODE_ENV === 'development'
                ? 'http://localhost:3000'
                : `file://${join(__dirname, '..', '..', './build/index.html')}`)
    );

    window.once('ready-to-show', () => {
        autoUpdater.checkForUpdatesAndNotify();
    });

    window.on('close', (e) => {
        if (!globalState.isQuiting) {
            e.preventDefault();

            window.hide();
        }
    });

    return window;
};

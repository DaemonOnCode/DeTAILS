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
            return join(__dirname, '..', '..', 'public', 'apple-touch-icon.png'); // Use PNG if .icns is unavailable
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
            devTools: globalState.isDev,
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
            join(__dirname, '..', '..', 'public', 'android-chrome-512x512.png')
        );
        app.dock.setIcon(dockIcon);
    }

    remote.enable(window.webContents);

    await window.loadURL(
        globalState.isDev
            ? 'http://localhost:3000'
            : `file://${join(__dirname, '..', '../build/index.html')}`
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

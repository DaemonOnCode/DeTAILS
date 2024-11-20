const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const { createMainWindow } = require('./utils/createMainWindow');
const AutoLaunch = require('auto-launch');
const remote = require('@electron/remote/main');
const config = require('./utils/config');
const registerIpcHandlers = require('./handles');

if (config.isDev) {
    require('electron-reloader')(module, {
        ignore: [/\.db$/]
    });
}

remote.initialize();

if (!config.isDev) {
    const autoStart = new AutoLaunch({
        name: config.appName
    });
    autoStart.enable();
}

app.on('ready', async () => {
    config.mainWindow = await createMainWindow();

    // await Promise.allSettled([executeOllama(app), executeChromadb(app)]);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) config.mainWindow = createMainWindow();
});

ipcMain.on('app_version', (event) => {
    event.sender.send('app_version', { version: app.getVersion() });
});

autoUpdater.on('update-available', () => {
    config.mainWindow.webContents.send('update_available');
});

autoUpdater.on('update-downloaded', () => {
    config.mainWindow.webContents.send('update_downloaded');
});

ipcMain.on('restart_app', () => {
    autoUpdater.quitAndInstall();
});

registerIpcHandlers();

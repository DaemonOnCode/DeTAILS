const { ipcMain } = require('electron');
const { electronLogger } = require('../utils/electron-logger');

const workspaceHandler = (...ctxs) => {
    ipcMain.handle('import-workspace', (event, workspacePath) => {
        electronLogger.log(workspacePath);
    });

    ipcMain.handle('export-workspace', (event, data) => {
        electronLogger.log(data);
    });
};

module.exports = { workspaceHandler };

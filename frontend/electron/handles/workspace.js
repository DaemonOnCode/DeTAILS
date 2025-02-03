const { ipcMain } = require('electron');

const workspaceHandler = (...ctxs) => {
    ipcMain.handle('import-workspace', (event, workspacePath) => {
        console.log(workspacePath);
    });

    ipcMain.handle('export-workspace', (event, data) => {
        console.log(data);
    });
};

module.exports = { workspaceHandler };

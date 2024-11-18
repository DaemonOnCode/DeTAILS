const { ipcMain, dialog } = require('electron');
const config = require('../utils/config');

const fileHandler = () => {
    ipcMain.handle('select-folder', async () => {
        const result = await dialog.showOpenDialog(config.mainWindow, {
            properties: ['openDirectory']
        });
        return result.filePaths[0]; // Return the selected folder path
    });
};

module.exports = { fileHandler };

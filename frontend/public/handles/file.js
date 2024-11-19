const { ipcMain, dialog } = require('electron');
const config = require('../utils/config');

const fileHandler = () => {
    ipcMain.handle('select-folder', async () => {
        const result = await dialog.showOpenDialog(config.mainWindow, {
            properties: ['openDirectory']
        });
        return result.filePaths[0]; // Return the selected folder path
    });

    ipcMain.handle('select-files', async () => {
        const result = await dialog.showOpenDialog({
            properties: ['openFile', 'multiSelections']
        });
        const fullResult = result.filePaths.map((path) => {
            return {
                fileName: path.split('/').pop(),
                filePath: path
            };
        });
        console.log(fullResult);
        return fullResult; // Return the selected file paths
    });
};

module.exports = { fileHandler };

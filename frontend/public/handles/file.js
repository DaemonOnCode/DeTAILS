const { ipcMain, dialog } = require('electron');
const config = require('../utils/config');
const logger = require('../utils/logger');

const fileHandler = () => {
    ipcMain.handle('select-folder', async () => {
        await logger.info('Selecting folder');
        const result = await dialog.showOpenDialog(config.mainWindow, {
            properties: ['openDirectory']
        });
        await logger.info('Selected folder:', { folderPath: result.filePaths[0] });
        return result.filePaths[0]; // Return the selected folder path
    });

    ipcMain.handle('select-files', async () => {
        await logger.info('Selecting files');
        const result = await dialog.showOpenDialog({
            properties: ['openFile', 'multiSelections'],
            filters: [{ name: 'Documents', extensions: ['txt', 'docx', 'pdf'] }]
        });
        await logger.info('Selected files:', { filePaths: result.filePaths });
        const fullResult = result.filePaths.map((path) => {
            return {
                fileName: path.split('/').pop(),
                filePath: path
            };
        });
        await logger.info('Full result:', { fullResult });
        console.log(fullResult);
        return fullResult; // Return the selected file paths
    });
};

module.exports = { fileHandler };

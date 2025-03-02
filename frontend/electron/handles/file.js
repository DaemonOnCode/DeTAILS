const { ipcMain, dialog } = require('electron');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { findContextByName } = require('../utils/context');
const { electronLogger } = require('../utils/electron-logger');

function flattenObject(obj, parentKey = '', separator = '.') {
    const flattened = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const newKey = parentKey ? `${parentKey}${separator}${key}` : key;
            const value = obj[key];
            if (Array.isArray(value)) {
                // Join array values into a comma-separated string
                flattened[newKey] = value.join(', ');
            } else if (typeof value === 'object' && value !== null) {
                // Recursively flatten nested objects
                Object.assign(flattened, flattenObject(value, newKey, separator));
            } else {
                // Assign primitive values directly
                flattened[newKey] = value;
            }
        }
    }
    return flattened;
}

const fileHandler = (...ctxs) => {
    const globalCtx = findContextByName('global', ctxs);
    ipcMain.handle('select-folder-reddit', async () => {
        await logger.info('Selecting folder');
        const result = await dialog.showOpenDialog(globalCtx.getState().mainWindow, {
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
        electronLogger.log(fullResult);
        return fullResult; // Return the selected file paths
    });

    // Handler for saving CSV
    ipcMain.handle('save-csv', async (event, { data, fileName }) => {
        electronLogger.log('Saving CSV:', { fileName });
        try {
            // Open Save Dialog
            const { filePath } = await dialog.showSaveDialog({
                title: 'Save CSV File',
                defaultPath: path.join(__dirname, `${fileName || 'data'}.csv`),
                filters: [{ name: 'CSV Files', extensions: ['csv'] }]
            });

            if (filePath) {
                // Write data to the file
                fs.writeFileSync(filePath, data, 'utf8');
                return { success: true, filePath };
            }
            return { success: false, message: 'No file selected' };
        } catch (error) {
            electronLogger.error('Error saving CSV:', error);
            return { success: false, message: error.message };
        }
    });

    // Handler for saving Excel
    ipcMain.handle('save-excel', async (event, { data, fileName }) => {
        try {
            // Open Save Dialog
            const { filePath } = await dialog.showSaveDialog({
                title: 'Save Excel File',
                defaultPath: path.join(__dirname, `${fileName || 'data'}.xlsx`),
                filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
            });

            if (filePath) {
                // Preprocess data to flatten nested objects and arrays
                const processedData = data.map((item) => flattenObject(item));

                // Create an Excel Workbook
                const worksheet = XLSX.utils.json_to_sheet(processedData); // Convert JSON to Worksheet
                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

                // Write Excel file
                XLSX.writeFile(workbook, filePath);
                return { success: true, filePath };
            }
            return { success: false, message: 'No file selected' };
        } catch (error) {
            electronLogger.error('Error saving Excel:', error);
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle('save-file', async (event) => {
        await logger.info('Saving file');
        const result = await dialog.showSaveDialog({
            title: 'Save File',
            defaultPath: path.join(__dirname, 'example.txt'),
            filters: [{ name: 'Text Files', extensions: ['txt'] }]
        });
        await logger.info('Saved file:', { filePath: result.filePath });
        return result.filePath; // Return the saved file path
    });
};

module.exports = { fileHandler };

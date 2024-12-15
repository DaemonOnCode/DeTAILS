const { ipcMain, dialog } = require('electron');
const config = require('../utils/config');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

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

    // Handler for saving CSV
    ipcMain.handle('save-csv', async (event, { data, fileName }) => {
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
            console.error('Error saving CSV:', error);
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
                // Create an Excel Workbook
                const worksheet = XLSX.utils.json_to_sheet(data); // Convert JSON to Worksheet
                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

                // Write Excel file
                XLSX.writeFile(workbook, filePath);
                return { success: true, filePath };
            }
            return { success: false, message: 'No file selected' };
        } catch (error) {
            console.error('Error saving Excel:', error);
            return { success: false, message: error.message };
        }
    });
};

module.exports = { fileHandler };

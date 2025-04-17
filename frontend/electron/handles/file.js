const { ipcMain, dialog } = require('electron');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { findContextByName } = require('../utils/context');
const { electronLogger } = require('../utils/electron-logger');

function flattenObjectExcel(obj, parentKey = '', separator = '.') {
    const flattened = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const newKey = parentKey ? `${parentKey}${separator}${key}` : key;
            const value = obj[key];
            if (Array.isArray(value)) {
                flattened[newKey] = value.join(', ');
            } else if (typeof value === 'object' && value !== null) {
                Object.assign(flattened, flattenObjectExcel(value, newKey, separator));
            } else {
                flattened[newKey] = value;
            }
        }
    }
    return flattened;
}

function escapeCSV(value) {
    if (typeof value === 'string') {
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
    }
    return String(value);
}

function flattenObject(obj, prefix = '') {
    let result = {};
    for (let key in obj) {
        if (obj.hasOwnProperty(key)) {
            if (Array.isArray(obj[key])) {
                result[prefix + key] = obj[key].join(', ');
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                let nested = flattenObject(obj[key], `${prefix}${key}.`);
                result = { ...result, ...nested };
            } else {
                result[prefix + key] = obj[key];
            }
        }
    }
    return result;
}

function arrayOfObjectsToCSV(data) {
    const flattenedData = data.map((obj) => flattenObject(obj));
    const allKeys = new Set();
    flattenedData.forEach((obj) => {
        Object.keys(obj).forEach((key) => allKeys.add(key));
    });
    const headers = Array.from(allKeys).sort();
    const rows = flattenedData.map((obj) => {
        return headers.map((header) => escapeCSV(obj[header] ?? ''));
    });
    const headerRow = headers.map(escapeCSV).join(',');
    const dataRows = rows.map((row) => row.join(',')).join('\n');
    return `${headerRow}\n${dataRows}`;
}

function twoDArrayToCSV(data) {
    return data.map((row) => row.map(escapeCSV).join(',')).join('\n');
}

function columnsToCSV(data) {
    const headers = Object.keys(data);
    const numRows = data[headers[0]].length;
    const rows = [];
    for (let i = 0; i < numRows; i++) {
        const row = headers.map((header) => escapeCSV(data[header][i]));
        rows.push(row.join(','));
    }
    const headerRow = headers.map(escapeCSV).join(',');
    return `${headerRow}\n${rows.join('\n')}`;
}

function toCSV(data) {
    if (typeof data === 'string') {
        return data;
    } else if (Array.isArray(data)) {
        if (data.length === 0) {
            return '';
        }
        if (typeof data[0] === 'object' && !Array.isArray(data[0])) {
            return arrayOfObjectsToCSV(data);
        } else if (Array.isArray(data[0])) {
            return twoDArrayToCSV(data);
        } else {
            return data.map((item) => escapeCSV(item)).join('\n');
        }
    } else if (typeof data === 'object' && data !== null) {
        const values = Object.values(data);
        if (values.every((val) => Array.isArray(val))) {
            const lengths = values.map((val) => val.length);
            if (lengths.every((len) => len === lengths[0])) {
                return columnsToCSV(data);
            }
        }
        return arrayOfObjectsToCSV([data]);
    } else {
        return escapeCSV(data);
    }
}

const fileHandler = (...ctxs) => {
    const globalCtx = findContextByName('global', ctxs);
    ipcMain.handle('select-folder', async () => {
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

    ipcMain.handle('save-csv', async (event, { data, fileName }) => {
        electronLogger.log('Saving CSV:', { fileName });
        try {
            const csvData = toCSV(data);

            const { filePath } = await dialog.showSaveDialog({
                title: 'Save CSV File',
                defaultPath: path.join(__dirname, `${fileName || 'data'}.csv`),
                filters: [{ name: 'CSV Files', extensions: ['csv'] }]
            });

            if (filePath) {
                fs.writeFileSync(filePath, csvData, 'utf8');
                return { success: true, filePath };
            }
            return { success: false, message: 'No file selected' };
        } catch (error) {
            electronLogger.error('Error saving CSV:', error);
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle('save-excel', async (event, { data, fileName }) => {
        try {
            const { filePath } = await dialog.showSaveDialog({
                title: 'Save Excel File',
                defaultPath: path.join(__dirname, `${fileName || 'data'}.xlsx`),
                filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
            });

            if (filePath) {
                const processedData = data.map((item) => flattenObjectExcel(item));

                const worksheet = XLSX.utils.json_to_sheet(processedData);
                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

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
        return result.filePath;
    });

    ipcMain.handle('select-file', async (event, extensions) => {
        await logger.info('Selecting file');
        const result = await dialog.showOpenDialog({
            properties: ['openFile'],
            filters: [{ name: 'Documents', extensions: extensions }]
        });
        electronLogger.log('Selected file:', { filePath: result.filePaths[0] });
        return result.filePaths[0] ?? '';
    });
};

module.exports = { fileHandler };

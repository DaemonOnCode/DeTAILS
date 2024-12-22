const { ipcMain } = require('electron');
const config = require('../utils/config');
const { spawnServices } = require('../utils/spawn-services');

const processingHandler = () => {
    ipcMain.handle('set-processing-mode', (event, arg) => {
        console.log(arg);
        config.processing = arg ? 'remote' : 'local';
        return config.processing;
    });

    ipcMain.handle('start-services', async (event) => {
        spawnServices();
    });
};

module.exports = { processingHandler };

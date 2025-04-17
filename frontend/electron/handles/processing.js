const { ipcMain } = require('electron');
const { spawnServices, spawnedProcesses } = require('../utils/spawn-services');
const { findContextByName } = require('../utils/context');
const { electronLogger } = require('../utils/electron-logger');
const { killProcess } = require('../utils/kill-process');

const processingHandler = (...ctxs) => {
    const globalCtx = findContextByName('global', ctxs);

    ipcMain.handle('set-processing-mode', (event, arg) => {
        electronLogger.log(arg);
        let value = arg ? 'remote' : 'local';
        globalCtx.setState({ processing: value });
        return value;
    });

    ipcMain.handle('start-services', async (event) => {
        spawnServices(globalCtx);
    });

    ipcMain.handle('stop-services', async (event) => {
        for (const { name, process } of spawnedProcesses) {
            electronLogger.log(`Terminating process: ${name}`);
            killProcess(process);
        }
    });
};

module.exports = { processingHandler };

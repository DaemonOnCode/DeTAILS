const { ipcMain } = require('electron');
const { spawnServices } = require('../utils/spawn-services');
const { findContextByName } = require('../utils/context');

const processingHandler = (...ctxs) => {
    const globalCtx = findContextByName('global', ctxs);

    ipcMain.handle('set-processing-mode', (event, arg) => {
        console.log(arg);
        let value = arg ? 'remote' : 'local';
        globalCtx.setState({ processing: value });
        return value;
    });

    ipcMain.handle('start-services', async (event) => {
        spawnServices(globalCtx);
    });
};

module.exports = { processingHandler };

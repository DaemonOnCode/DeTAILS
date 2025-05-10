const { Menu, dialog } = require('electron');
const { findContextByName } = require('./context');
const { electronLogger } = require('./electron-logger');

const menuTemplate = (state) => {
    const isUserLoaded = state.userEmail && state.userEmail !== 'Anonymous';

    return [
        {
            label: 'File',
            submenu: [
                {
                    label: 'Save workspace',
                    accelerator: 'CmdOrCtrl+S',
                    enabled: isUserLoaded,
                    click: () => {
                        electronLogger.log(
                            'Save workspace',
                            state,
                            state.mainWindow,
                            state.mainWindow.webContents
                        );
                        state.mainWindow.webContents.send('menu-save-workspace');
                    }
                },
                { type: 'separator' },
                { label: 'Exit', role: 'quit' }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                {
                    label: 'Undo',
                    accelerator: 'CmdOrCtrl+Z',
                    selector: 'undo:',
                    click: () => {
                        electronLogger.log('Undo clicked');
                        state.mainWindow.webContents.send('undo');
                    }
                },
                { type: 'separator' },
                { label: 'Cut', accelerator: 'CmdOrCtrl+X', selector: 'cut:' },
                { label: 'Copy', accelerator: 'CmdOrCtrl+C', selector: 'copy:' },
                { label: 'Paste', accelerator: 'CmdOrCtrl+V', selector: 'paste:' },
                { label: 'Select All', accelerator: 'CmdOrCtrl+A', selector: 'selectAll:' }
            ]
        },
        {
            label: 'View',
            submenu: [{ label: 'Toggle Developer Tools', role: 'toggleDevTools' }]
        }
    ];
};

function createMenu(...ctxs) {
    const globalCtx = findContextByName('global', ctxs);

    const isUserLoaded =
        globalCtx.getState().userEmail && globalCtx.getState().userEmail !== 'Anonymous';
    const state = globalCtx.getState();
    electronLogger.log('Creating menu', isUserLoaded);
    const menu = Menu.buildFromTemplate(menuTemplate(state));
    Menu.setApplicationMenu(menu);

    globalCtx.subscribe((newState) => {
        const menu = Menu.buildFromTemplate(menuTemplate(newState));
        Menu.setApplicationMenu(menu);
    });
}

module.exports = { createMenu };

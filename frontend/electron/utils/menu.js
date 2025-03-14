const { Menu, dialog } = require('electron');
const { findContextByName } = require('./context');
const { electronLogger } = require('./electron-logger');

const menuTemplate = (state) => {
    // Determine if a user is loaded.
    const isUserLoaded = state.userEmail && state.userEmail !== 'Anonymous';

    return [
        {
            label: 'File',
            submenu: [
                // {
                //     label: 'New File',
                //     accelerator: 'CmdOrCtrl+N',
                //     click: () => electronLogger.log('New File')
                // },
                // {
                //     label: 'Open File',
                //     accelerator: 'CmdOrCtrl+O',
                //     click: () => electronLogger.log('Open File')
                // },
                // { type: 'separator' },
                {
                    label: 'Save workspace',
                    accelerator: 'CmdOrCtrl+S',
                    enabled: isUserLoaded, // Disabled if user not logged in.
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
                {
                    label: 'Import workspace',
                    accelerator: 'CmdOrCtrl+I',
                    enabled: isUserLoaded, // Disabled if user not logged in.
                    click: async () => {
                        if (!isUserLoaded) return;
                        const { canceled, filePaths } = await dialog.showOpenDialog({
                            properties: ['openFile'],
                            filters: [{ name: 'ZIP', extensions: ['zip'] }]
                        });
                        if (!canceled && filePaths.length > 0) {
                            globalCtx
                                .getState()
                                .mainWindow.webContents.send('menu-import-workspace', filePaths[0]);
                        }
                    }
                },
                {
                    label: 'Export workspace',
                    accelerator: 'CmdOrCtrl+E',
                    enabled: isUserLoaded, // Disabled if user not logged in.
                    click: async () => {
                        if (!isUserLoaded) return;
                        state.mainWindow.webContents.send('menu-export-workspace');
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
                { label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', selector: 'redo:' },
                { type: 'separator' },
                { label: 'Cut', accelerator: 'CmdOrCtrl+X', selector: 'cut:' },
                { label: 'Copy', accelerator: 'CmdOrCtrl+C', selector: 'copy:' },
                { label: 'Paste', accelerator: 'CmdOrCtrl+V', selector: 'paste:' },
                { label: 'Select All', accelerator: 'CmdOrCtrl+A', selector: 'selectAll:' }
            ]
        },
        {
            label: 'View',
            submenu: [
                { label: 'Reload', role: 'reload' },
                { label: 'Toggle Developer Tools', role: 'toggleDevTools' }
            ]
        },
        {
            label: 'Help',
            submenu: [{ label: 'About', click: () => electronLogger.log('About clicked') }]
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

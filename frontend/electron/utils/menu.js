const { Menu, dialog } = require('electron');
const { findContextByName } = require('./context');
// const globalCtx.getState() = require('./global-state');

const menuTemplate = (globalCtx) => [
    {
        label: 'File',
        submenu: [
            {
                label: 'New File',
                accelerator: 'CmdOrCtrl+N',
                click: () => console.log('New File')
            },
            {
                label: 'Open File',
                accelerator: 'CmdOrCtrl+O',
                click: () => console.log('Open File')
            },
            { type: 'separator' },
            {
                label: 'Save workspace',
                accelerator: 'CmdOrCtrl+S',
                click: () => {
                    globalCtx.getState().mainWindow.webContents.send('menu-save-workspace');
                }
            },
            {
                label: 'Import workspace',
                accelerator: 'CmdOrCtrl+I',
                click: async () => {
                    if (
                        !globalCtx.getState().userEmail ||
                        globalCtx.getState().userEmail === 'Anonymous'
                    )
                        return;
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
                click: async () => {
                    if (
                        !globalCtx.getState().userEmail ||
                        globalCtx.getState().userEmail === 'Anonymous'
                    )
                        return;
                    globalCtx.getState().mainWindow.webContents.send('menu-export-workspace');
                }
            },
            { type: 'separator' },
            { label: 'Exit', role: 'quit' }
        ]
    },
    {
        label: 'Edit',
        submenu: [
            { role: 'undo' },
            { role: 'redo' },
            { type: 'separator' },
            { role: 'cut' },
            { role: 'copy' },
            { role: 'paste' },
            { role: 'selectAll' }
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
        submenu: [{ label: 'About', click: () => console.log('About clicked') }]
    }
];

function createMenu(...ctxs) {
    const globalCtx = findContextByName('global', ctxs);

    const isUserLoaded =
        globalCtx.getState().userEmail && globalCtx.getState().userEmail !== 'Anonymous';
    console.log('Creating menu', isUserLoaded);
    const menu = Menu.buildFromTemplate(menuTemplate(globalCtx));
    Menu.setApplicationMenu(menu);
}

module.exports = { createMenu };

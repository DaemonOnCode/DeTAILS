const { Menu, dialog } = require('electron');
const config = require('./global-state');

const menuTemplate = [
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
                    config.mainWindow.webContents.send('menu-save-workspace');
                }
            },
            {
                label: 'Import workspace',
                accelerator: 'CmdOrCtrl+I',
                click: async () => {
                    if (!config.userEmail || config.userEmail === 'Anonymous') return;
                    const { canceled, filePaths } = await dialog.showOpenDialog({
                        properties: ['openFile'],
                        filters: [{ name: 'ZIP', extensions: ['zip'] }]
                    });
                    if (!canceled && filePaths.length > 0) {
                        config.mainWindow.webContents.send('menu-import-workspace', filePaths[0]);
                    }
                }
            },
            {
                label: 'Export workspace',
                accelerator: 'CmdOrCtrl+E',
                click: async () => {
                    if (!config.userEmail || config.userEmail === 'Anonymous') return;
                    config.mainWindow.webContents.send('menu-export-workspace');
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

function createMenu() {
    const isUserLoaded = config.userEmail && config.userEmail !== 'Anonymous';
    console.log('Creating menu', isUserLoaded);
    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);
}

module.exports = { createMenu };

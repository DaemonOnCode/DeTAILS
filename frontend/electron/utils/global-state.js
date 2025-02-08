const { join } = require('path');

let globalState = {
    appName: 'DeTAILS',
    icon: join(__dirname, '..', 'public', 'favicon.ico'),
    tray: null,
    isQuiting: true,
    mainWindow: null,
    // popupWindow: null,
    browserView: null,
    backendServer: 'http://34.130.161.42',
    userEmail: 'Anonymous',
    websocket: null,
    processing: 'local'
};

module.exports = globalState;

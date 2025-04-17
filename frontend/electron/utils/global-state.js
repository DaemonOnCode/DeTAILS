const { join } = require('path');

let globalState = {
    appName: 'DeTAILS',
    icon: join(__dirname, '..', 'public', 'favicon.ico'),
    isQuiting: true,
    mainWindow: null,
    browserView: null,
    backendServer: 'http://34.130.161.42',
    userEmail: 'Anonymous',
    websocket: null,
    processing: 'local'
};

module.exports = globalState;

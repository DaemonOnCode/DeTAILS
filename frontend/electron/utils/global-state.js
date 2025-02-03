const { join } = require('path');
const isDevPromise = import('electron-is-dev').then((module) => module.default);

async function getIsDev() {
    return await isDevPromise;
}

let globalState = {
    appName: 'CTA Toolkit',
    icon: join(__dirname, '..', 'public', 'favicon.ico'),
    tray: null,
    isQuiting: true,
    mainWindow: null,
    // popupWindow: null,
    get isDev() {
        return getIsDev();
    },
    browserView: null,
    backendServer: 'http://34.130.161.42',
    userEmail: 'Anonymous',
    websocket: null,
    processing: 'local'
};

module.exports = globalState;

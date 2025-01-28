const { join } = require('path');
const isDevPromise = import('electron-is-dev').then((module) => module.default);

async function getIsDev() {
    return await isDevPromise;
}

let config = {
    appName: 'CTA Toolkit',
    icon: join(__dirname, '..', '/favicon.ico'),
    tray: null,
    isQuiting: true,
    mainWindow: null,
    // popupWindow: null,
    get isDev() {
        return getIsDev();
    },
    browserView: null,
    backendServer: 'http://localhost:8080',
    userEmail: 'Anonymous',
    websocket: null,
    processing: 'local'
};

module.exports = config;

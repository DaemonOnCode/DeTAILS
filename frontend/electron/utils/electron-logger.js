const log = require('electron-log');
const { app } = require('electron');

const electronLogger = (() => {
    // if (process.env.NODE_ENV === 'development') {
    //     return console;
    // }
    log.transports.file.setAppName('DeTAILS');
    log.transports.file.resolvePathFn = () => `${app.getPath('userData')}/logs/main.log`;
    console.log('Log path: ', `${app.getPath('userData')}/logs/main.log`);
    console = Object.assign(console, log.functions);
    console.log;
    return console;
})();

module.exports = {
    electronLogger
};

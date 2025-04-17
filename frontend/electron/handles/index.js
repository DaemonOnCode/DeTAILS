const { fileHandler } = require('./file');
const { redditHandler } = require('./reddit');
const { authHandler } = require('./authentication');
const { websocketHandler } = require('./websocket');
const { workspaceHandler } = require('./workspace');
const { processingHandler } = require('./processing');
const { webviewHandler } = require('./webview-render');
const { settingsHandler } = require('./settings');

const registerIpcHandlers = (...ctxs) => {
    const handlerList = [
        settingsHandler,
        authHandler,
        redditHandler,
        fileHandler,
        webviewHandler,
        websocketHandler,
        workspaceHandler,
        processingHandler
    ];

    handlerList.forEach((handler) => handler(...ctxs));
};

module.exports = registerIpcHandlers;

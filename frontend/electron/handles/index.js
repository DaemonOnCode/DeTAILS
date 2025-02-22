const { fileHandler } = require('./file');
const { redditHandler } = require('./reddit');
// const { langchainHandler } = require('./langchain');
const { dbHandler } = require('./db');
const { authHandler } = require('./authentication');
const { websocketHandler } = require('./websocket');
const { workspaceHandler } = require('./workspace');
const { processingHandler } = require('./processing');
const { interviewHandler } = require('./interview');
// const { workerHandler } = require('./worker');

const registerIpcHandlers = (...ctxs) => {
    // authHandler();
    // redditHandler();
    // fileHandler();
    // // langchainHandler();
    // // workerHandler();
    // dbHandler();
    // websocketHandler();
    // workspaceHandler();
    // processingHandler();

    const handlerList = [
        authHandler,
        redditHandler,
        fileHandler,
        dbHandler,
        websocketHandler,
        workspaceHandler,
        processingHandler,
        interviewHandler
    ];

    handlerList.forEach((handler) => handler(...ctxs));
};

module.exports = registerIpcHandlers;

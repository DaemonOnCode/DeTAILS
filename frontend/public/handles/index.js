const { fileHandler } = require('./file');
const { redditHandler } = require('./reddit');
const { langchainHandler } = require('./langchain');
const { dbHandler } = require('./db');
const { googleOAuthHandler } = require('./google-oauth');
const { websocketHandler } = require('./websocket');
const { workspaceHandler } = require('./workspace');
const { processingHandler } = require('./processing');
// const { workerHandler } = require('./worker');

const registerIpcHandlers = () => {
    googleOAuthHandler();
    redditHandler();
    fileHandler();
    langchainHandler();
    // workerHandler();
    dbHandler();
    websocketHandler();
    workspaceHandler();
    processingHandler();
};

module.exports = registerIpcHandlers;

const { fileHandler } = require('./file');
const { redditHandler } = require('./reddit');
const { langchainHandler } = require('./langchain');
const { dbHandler } = require('./db');
// const { workerHandler } = require('./worker');

const registerIpcHandlers = () => {
    redditHandler();
    fileHandler();
    langchainHandler();
    // workerHandler();
    dbHandler();
};

module.exports = registerIpcHandlers;

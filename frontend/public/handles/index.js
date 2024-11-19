const { fileHandler } = require('./file');
const { redditHandler } = require('./reddit');
const { langchainHandler } = require('./langchain');

const registerIpcHandlers = () => {
    redditHandler();
    fileHandler();
    langchainHandler();
};

module.exports = registerIpcHandlers;

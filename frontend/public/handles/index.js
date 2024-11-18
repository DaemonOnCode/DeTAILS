const { fileHandler } = require('./file');
const { redditHandler } = require('./reddit');

const registerIpcHandlers = () => {
    redditHandler();
    fileHandler();
};

module.exports = registerIpcHandlers;

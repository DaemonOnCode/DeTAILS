const { findContextByName } = require('../utils/context');

const interviewHandler = (...ctxs) => {
    const globalCtx = findContextByName('global', ctxs);
};

module.exports = { interviewHandler };

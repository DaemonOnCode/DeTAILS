function getTimestamp() {
    if (typeof performance !== 'undefined' && performance.now) {
        return performance.now() / 1000;
    }
    // Fallback to Date.now() if performance.now() is unavailable
    return Date.now() / 1000;
}

function createTimer() {
    let startTime = getTimestamp();
    return {
        start: function () {
            startTime = getTimestamp();
        },
        end: function () {
            return getTimestamp() - startTime;
        },
        reset: function () {
            startTime = getTimestamp();
        }
    };
}

module.exports = {
    createTimer
};

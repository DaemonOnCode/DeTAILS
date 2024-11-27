// Helper to get the current timestamp, compatible with both React and Electron
function getTimestamp() {
    // Use performance.now() for high-resolution time
    if (typeof performance !== 'undefined' && performance.now) {
        return performance.now() / 1000;
    }
    // Fallback to Date.now() if performance.now() is unavailable
    return Date.now() / 1000;
}

export function createTimer() {
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

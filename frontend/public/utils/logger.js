// const os = require('os');
// const config = require('./config');

// // Define log levels
// const LOG_LEVELS = ['info', 'warning', 'error', 'debug'];

// // Logging server URL
// const LOGGING_SERVER_URL = 'http://localhost:9000/api/log';

// const sendLog = async (level, message, context = {}) => {
//     if (!LOG_LEVELS.includes(level)) {
//         console.error(`Invalid log level: ${level}`);
//         return;
//     }

//     const logEntry = {
//         sender: 'ELECTRON',
//         email: config.userEmail,
//         level,
//         message,
//         context,
//         timestamp: new Date().toISOString()
//     };

//     try {
//         await fetch(LOGGING_SERVER_URL, {
//             method: 'POST',
//             body: JSON.stringify(logEntry),
//             headers: { 'Content-Type': 'application/json' }
//         });
//         console.log(`[${level.toUpperCase()}]: ${message}`);
//     } catch (error) {
//         console.error(`Failed to send log to server: ${error.message}`);
//     }
// };

// const logSystemAndProcessMetrics = () => {
//     const getSystemCpuUsage = () => {
//         const cpus = os.cpus();
//         let totalIdle = 0;
//         let totalTick = 0;

//         cpus.forEach((cpu) => {
//             for (let type in cpu.times) {
//                 totalTick += cpu.times[type];
//             }
//             totalIdle += cpu.times.idle;
//         });

//         return ((1 - totalIdle / totalTick) * 100).toFixed(2);
//     };

//     const getProcessCpuUsage = () => {
//         const cpuUsage = process.cpuUsage();
//         return {
//             user: (cpuUsage.user / 1000 / 1000).toFixed(2), // User CPU time in ms
//             system: (cpuUsage.system / 1000 / 1000).toFixed(2) // System CPU time in ms
//         };
//     };

//     const getProcessMemoryUsage = () => {
//         const memoryUsage = process.memoryUsage();
//         return {
//             rss: (memoryUsage.rss / 1024 / 1024).toFixed(2), // Resident Set Size in MB
//             heapTotal: (memoryUsage.heapTotal / 1024 / 1024).toFixed(2), // Total Heap in MB
//             heapUsed: (memoryUsage.heapUsed / 1024 / 1024).toFixed(2), // Used Heap in MB
//             external: (memoryUsage.external / 1024 / 1024).toFixed(2) // External Memory in MB
//         };
//     };

//     const getSystemMemoryUsage = () => {
//         const totalMemory = os.totalmem();
//         const freeMemory = os.freemem();
//         return {
//             total: (totalMemory / 1024 / 1024).toFixed(2), // Total system memory in MB
//             free: (freeMemory / 1024 / 1024).toFixed(2), // Free system memory in MB
//             used: ((totalMemory - freeMemory) / 1024 / 1024).toFixed(2) // Used memory in MB
//         };
//     };

//     // Log periodically
//     setInterval(async () => {
//         console.log('Logging system and process metrics...');
//         const systemCpuUsage = getSystemCpuUsage();
//         const systemMemoryUsage = getSystemMemoryUsage();
//         const processMemoryUsage = getProcessMemoryUsage();
//         const processCpuUsage = getProcessCpuUsage();

//         const logContext = {
//             systemCpuUsage: `${systemCpuUsage}%`,
//             systemMemoryUsage,
//             processMemoryUsage,
//             processCpuUsage,
//             platform: os.platform()
//         };

//         await sendLog('info', 'Periodic System and Process Metrics', logContext);
//     }, 60 * 1000); // Log every 1 minute
// };

// module.exports = {
//     info: (message, ...context) => sendLog('info', message, { ...context }),
//     warning: (message, ...context) => sendLog('warning', message, { ...context }),
//     error: (message, ...context) => sendLog('error', message, { ...context }),
//     debug: (message, ...context) => sendLog('debug', message, { ...context }),
//     logSystemAndProcessMetrics
// };

// const os = require('os');

// // Define log levels
// const LOG_LEVELS = ['info', 'warning', 'error', 'debug'];

// // Simplified logging to console
// const sendLog = async (level, message, context = {}) => {
//     if (!LOG_LEVELS.includes(level)) {
//         console.error(`Invalid log level: ${level}`);
//         return;
//     }

//     console.log(`[${level.toUpperCase()}]: ${message}`, context);
// };

// // Simplified periodic logging
// const logSystemAndProcessMetrics = () => {
//     const getSystemMemoryUsage = () => {
//         const totalMemory = os.totalmem();
//         const freeMemory = os.freemem();
//         return {
//             total: (totalMemory / 1024 / 1024).toFixed(2), // Total system memory in MB
//             free: (freeMemory / 1024 / 1024).toFixed(2), // Free system memory in MB
//             used: ((totalMemory - freeMemory) / 1024 / 1024).toFixed(2) // Used memory in MB
//         };
//     };

//     setInterval(() => {
//         const systemMemoryUsage = getSystemMemoryUsage();
//         sendLog('info', 'System Memory Usage', systemMemoryUsage);
//     }, 60 * 1000); // Log every 1 minute
// };

// // Expose basic logging functions
// module.exports = {
//     info: (message, context = {}) => sendLog('info', message, context),
//     warning: (message, context = {}) => sendLog('warning', message, context),
//     error: (message, context = {}) => sendLog('error', message, context),
//     debug: (message, context = {}) => sendLog('debug', message, context),
//     logSystemAndProcessMetrics
// };

const os = require('os');
// const config = require('./config');
let config;

// try {
//     config = require('./config');
// } catch (e) {
//     console.log('Error loading config: ', e);
// }

const LOGGING = true;

const LOGGING_SERVER_URL = 'http://20.51.212.222/logging/api/log';
// Define log levels
const LOG_LEVELS = ['info', 'warning', 'error', 'debug', 'health', 'time'];

const sendLog = async (level, message, context, loggerContext) => {
    if (!LOG_LEVELS.includes(level)) {
        console.error(`Invalid log level: ${level}`);
    }

    if (!loggerContext) {
        try {
            config = require('./config');
        } catch (e) {
            console.log('Error loading config: ', e);
        }
    }

    let email = config ? config.userEmail : (loggerContext?.userEmail ?? 'Anonymous');
    console.log('Email:', email);
    const logEntry = {
        sender: 'ELECTRON',
        email,
        level,
        message,
        context,
        timestamp: new Date().toISOString()
    };

    try {
        console.log(`[${level.toUpperCase()}]: ${message}`);
        if (!LOGGING) {
            return;
        }
        const response = await fetch(LOGGING_SERVER_URL, {
            method: 'POST',
            body: JSON.stringify(logEntry),
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) {
            throw new Error(`Failed to send log: ${response.statusText}`);
        }
    } catch (error) {
        console.error(`Failed to send log to server: ${error.message}`);
    }
};

// Simplified periodic logging
const logSystemAndProcessMetrics = () => {
    const os = require('os');

    // CPU Usage Function
    const getSystemCpuUsage = () => {
        const cpus = os.cpus();
        const loadAverage = os.loadavg(); // 1, 5, and 15-minute load averages

        let totalIdle = 0;
        let totalTick = 0;

        cpus.forEach((cpu, index) => {
            let coreTotalIdle = 0;
            let coreTotalTick = 0;

            for (let type in cpu.times) {
                coreTotalTick += cpu.times[type];
                if (type === 'idle') {
                    coreTotalIdle += cpu.times[type];
                }
            }

            totalIdle += coreTotalIdle;
            totalTick += coreTotalTick;

            // Log or return per-core usage
            cpu.usage = ((1 - coreTotalIdle / coreTotalTick) * 100).toFixed(2);
        });

        const averageCpuUsage = ((1 - totalIdle / totalTick) * 100).toFixed(2);

        return {
            cores: cpus.length,
            averageUsage: `${averageCpuUsage}%`, // Average usage across all cores
            perCoreUsage: cpus.map((cpu, index) => ({
                core: `Core ${index + 1}`,
                usage: `${cpu.usage}%`
            })),
            loadAverage: {
                '1-min': loadAverage[0].toFixed(2),
                '5-min': loadAverage[1].toFixed(2),
                '15-min': loadAverage[2].toFixed(2)
            }
        };
    };

    // Memory Usage Function
    const getSystemMemoryUsage = () => {
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;

        // Get percentages
        const usedPercentage = ((usedMemory / totalMemory) * 100).toFixed(2);
        const freePercentage = ((freeMemory / totalMemory) * 100).toFixed(2);

        return {
            totalMemoryMB: (totalMemory / 1024 / 1024).toFixed(2),
            usedMemoryMB: (usedMemory / 1024 / 1024).toFixed(2),
            freeMemoryMB: (freeMemory / 1024 / 1024).toFixed(2),
            usedPercentage: `${usedPercentage}%`,
            freePercentage: `${freePercentage}%`
        };
    };

    // Example usage
    console.log(getSystemCpuUsage());
    console.log(getSystemMemoryUsage());

    setInterval(() => {
        const systemMemoryUsage = getSystemMemoryUsage();
        const systemCpuUsage = getSystemCpuUsage();
        sendLog('health', 'System Memory Usage', {
            systemMemoryUsage,
            systemCpuUsage
        });
    }, 60 * 1000); // Log every 1 minute
};

// Expose basic logging functions
module.exports = {
    info: (message, context, loggerContext) => sendLog('info', message, context, loggerContext),
    warning: (message, context, loggerContext) =>
        sendLog('warning', message, context, loggerContext),
    error: (message, context, loggerContext) => sendLog('error', message, context, loggerContext),
    debug: (message, context, loggerContext) => sendLog('debug', message, context, loggerContext),
    health: (message, context, loggerContext) => sendLog('health', message, context, loggerContext),
    time: (message, context, loggerContext) => sendLog('time', message, context, loggerContext),
    logSystemAndProcessMetrics
};

let config;
const { electronLogger } = require('./electron-logger');

const LOGGING = false;

const LOG_LEVELS = ['info', 'warning', 'error', 'debug', 'health', 'time'];

const sendLog = async (level, message, context, loggerContext) => {
    if (!LOG_LEVELS.includes(level)) {
        electronLogger.error(`Invalid log level: ${level}`);
    }

    if (!loggerContext) {
        try {
            config = require('./global-state');
        } catch (e) {
            electronLogger.log('Error loading config: ', e);
        }
    }

    const LOGGING_SERVER_URL =
        config?.processing === 'remote'
            ? `${config.backendServer}/logging/api/log`
            : 'http://localhost:9000/api/log';

    let email = config ? config.userEmail : (loggerContext?.userEmail ?? 'Anonymous');
    electronLogger.log('Email:', email);
    const logEntry = {
        sender: 'ELECTRON',
        email,
        level,
        message,
        context,
        timestamp: new Date().toISOString()
    };

    try {
        electronLogger.log(`[${level.toUpperCase()}]: ${message}`);
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
        electronLogger.error(`Failed to send log to server: ${error.message}`);
    }
};

const logSystemAndProcessMetrics = () => {
    const os = require('os');

    const getSystemCpuUsage = () => {
        const cpus = os.cpus();
        const loadAverage = os.loadavg();

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

            cpu.usage = ((1 - coreTotalIdle / coreTotalTick) * 100).toFixed(2);
        });

        const averageCpuUsage = ((1 - totalIdle / totalTick) * 100).toFixed(2);

        return {
            cores: cpus.length,
            averageUsage: `${averageCpuUsage}%`,
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

    const getSystemMemoryUsage = () => {
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;

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

    electronLogger.log(getSystemCpuUsage());
    electronLogger.log(getSystemMemoryUsage());

    setInterval(() => {
        const systemMemoryUsage = getSystemMemoryUsage();
        const systemCpuUsage = getSystemCpuUsage();
        sendLog('health', 'System Memory Usage', {
            systemMemoryUsage,
            systemCpuUsage
        });
    }, 60 * 1000);
};

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

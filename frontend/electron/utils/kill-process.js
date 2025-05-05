const { execSync } = require('child_process');
const { electronLogger } = require('./electron-logger');

async function killProcess(spawnedProcess) {
    if (!spawnedProcess || typeof spawnedProcess.pid !== 'number') {
        return electronLogger.error('killProcess: invalid process or PID.');
    }
    const pid = spawnedProcess.pid;

    if (spawnedProcess.exitCode != null) {
        return electronLogger.log(
            `killProcess: PID ${pid} already exited with code ${spawnedProcess.exitCode}, skipping.`
        );
    }

    electronLogger.log(`killProcess: beginning graceful shutdown of PID ${pid}`);

    try {
        if (process.platform === 'win32') {
            execSync(`taskkill /PID ${pid}`);
        } else {
            process.kill(pid, 'SIGINT');
        }
        electronLogger.log(`killProcess: sent TERM to PID ${pid}`);
    } catch (err) {
        if (err.code !== 'ESRCH') {
            electronLogger.error(`killProcess: error sending TERM to ${pid}:`, err);
        } else {
            electronLogger.log(`killProcess: PID ${pid} not found (ESRCH), skipping TERM.`);
        }
    }
    await new Promise((resolve) => {
        let settled = false;

        const onExit = (code, signal) => {
            if (settled) return;
            settled = true;
            electronLogger.log(
                `killProcess: PID ${pid} exited on its own (code=${code}, signal=${signal})`
            );
            cleanup();
            resolve();
        };

        const to = setTimeout(() => {
            if (settled) return;
            settled = true;
            electronLogger.warn(
                `killProcess: PID ${pid} still alive after 15s, escalating to TERM.`
            );
            try {
                process.kill(pid, 'SIGTERM');
                electronLogger.log(`killProcess: sent TERM to PID ${pid}`);
            } catch (e) {
                if (e.code !== 'ESRCH') {
                    electronLogger.error(`killProcess: error sending TERM to ${pid}:`, e);
                } else {
                    electronLogger.log(`killProcess: PID ${pid} already gone when TERMing.`);
                }
            }
            cleanup();
            resolve();
        }, 5_000);

        function cleanup() {
            clearTimeout(to);
            spawnedProcess.removeListener('exit', onExit);
        }

        spawnedProcess.once('exit', onExit);
    });
}

module.exports = { killProcess };

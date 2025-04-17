const { execSync } = require('child_process');
const { electronLogger } = require('./electron-logger');

const killProcess = (spawnedProcess) => {
    if (process.platform === 'win32') {
        try {
            execSync(`taskkill /F /T /PID ${spawnedProcess.pid}`);
            electronLogger.log(`Successfully terminated ${name} and its subprocesses.`);
        } catch (err) {
            electronLogger.error(`Error terminating ${name}:`, err);
        }
    } else {
        if (spawnedProcess && spawnedProcess.pid) {
            try {
                spawnedProcess.kill();
                electronLogger.log(
                    `spawnedProcess with PID ${spawnedProcess.pid} killed successfully.`
                );
            } catch (error) {
                electronLogger.error(
                    `Error killing spawnedProcess with PID ${spawnedProcess.pid}:`,
                    error
                );
            }
        } else {
            electronLogger.error('Invalid process or PID.');
        }
    }
};

module.exports = {
    killProcess
};

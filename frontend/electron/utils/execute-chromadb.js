const { exec } = require('child_process');
const path = require('path');
const { electronLogger } = require('./electron-logger');

exports.executeChromadb = async (app) => {
    const chromadbPath = path.resolve(__dirname, '..', '..', '..', 'chroma', 'chromadb', 'cli');

    const escapedPath = `"${chromadbPath}"`;
    const chromadbExecutable = './dist/cli';

    // Start the Chromadb server
    const chromadbProcess = exec(
        `cd ${escapedPath} && ${chromadbExecutable} run`,
        (error, stdout, stderr) => {
            if (error) {
                console.error(`Chromadb failed to start: ${error.message}`);
                return;
            }
            if (stderr) {
                console.error(`Chromadb server stderr: ${stderr}`);
            }
            electronLogger.log(`Chromadb server stdout: ${stdout}`);
        }
    );

    chromadbProcess.stdout.on('data', (data) => {
        electronLogger.log(`Chromadb stdout: ${data}`);
    });

    // Cleanup on app close
    app.on('before-quit', () => {
        if (chromadbProcess) {
            chromadbProcess.kill(); // Terminate the Chromadb server
        }
    });
};

const { Worker } = require('worker_threads');
const { ipcMain } = require('electron');
const path = require('path');

const workerHandler = () => {
    ipcMain.on('process-comments', (event, folderPath, parsedData) => {
        const worker = new Worker(path.join(__dirname, '../workers/comment_worker.js'));

        worker.postMessage({ folderPath, parsedData });

        worker.on('message', (message) => {
            if (message.error) {
                event.reply('process-comments-error', message.error);
            } else {
                event.reply('process-comments-success', message.fullData);
            }
        });

        worker.on('error', (err) => {
            event.reply('process-comments-error', err.message);
        });

        worker.on('exit', (code) => {
            if (code !== 0) {
                event.reply('process-comments-error', `Worker stopped with exit code ${code}`);
            }
        });
    });
};

module.exports = {
    workerHandler
};

const { ipcMain } = require('electron');
const { Worker } = require('worker_threads');
const path = require('path');

const dbHandler = () => {
    ipcMain.handle('load-data', (event, folderPath, parsedData, dbPath) => {
        console.log('Loading data into database:', folderPath, dbPath, 'here????');

        return new Promise((resolve, reject) => {
            console.log('Loading data into database worker:', folderPath, dbPath);
            const workerPath = path.join(__dirname, '../workers/db_worker.js');
            const worker = new Worker(workerPath, {
                workerData: { folderPath, parsedData, dbPath }
            });

            console.log('Worker created:', workerPath);

            worker.on('message', (message) => {
                console.log('Message from worker:', message);
                if (message.success) {
                    console.log('Data loaded successfully:', message);
                    resolve(message);
                } else {
                    console.error('Error loading data:', message.error);
                    reject(new Error(message.error));
                }
            });

            worker.on('error', (err) => {
                console.error('Error in worker:', err.message);
                reject(err);
            });

            worker.on('exit', (code) => {
                console.log('Worker exited:', code);
                if (code !== 0) {
                    reject(new Error(`Worker stopped with exit code ${code}`));
                } else {
                    console.log('Worker exited successfully.');
                }
            });
        });
    });
};

module.exports = {
    dbHandler
};

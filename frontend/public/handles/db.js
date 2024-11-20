const { ipcMain } = require('electron');
const { Worker } = require('worker_threads');
const path = require('path');
const { initDatabase, getAllPostIdsAndTitles, getPostById } = require('../utils/db_helpers');

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

    // ipcMain.handle('get-data', (event, batchSize, offset, dbPath) => {});

    // ipcMain.handle('get-post', (event, postId, dbPath) => {});

    ipcMain.handle('get-post-ids-titles', async (event, dbPath) => {
        try {
            const db = initDatabase(dbPath);

            const result = await getAllPostIdsAndTitles(db);
            db.close();
            console.log('Post IDs and titles:', result);
            return result;
        } catch (err) {
            console.error('Error getting post IDs and titles:', err.message);
            return [];
        }
    });

    ipcMain.handle('get-post-by-id', async (event, postId, dbPath) => {
        try {
            console.log('Getting post by ID:', postId);
            const db = initDatabase(dbPath);
            const result = await getPostById(
                db,
                postId,
                ['id', 'title', 'selftext'],
                ['id', 'body', 'parent_id']
            );

            db.close();
            console.log('Post by ID:', result);
            return result;
        } catch (err) {
            console.error('Error getting post by ID:', err.message);
            return [];
        }
    });
};

module.exports = {
    dbHandler
};

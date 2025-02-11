const { ipcMain } = require('electron');
const { Worker } = require('worker_threads');
const path = require('path');
const {
    initDatabase,
    getAllPostIdsAndTitles,
    getPostById,
    loadPostsByBatch
} = require('../utils/db-helpers');
const logger = require('../utils/logger');
const { findContextByName } = require('../utils/context');
const { electronLogger } = require('../utils/electron-logger');

// const config = require('../utils/global-state');

const dbHandler = (...ctxs) => {
    const globalCtx = findContextByName('global', ctxs);
    ipcMain.handle('load-data', async (event, folderPath, parsedData, dbPath) => {
        await logger.info('Loading data into database:', { folderPath, dbPath });
        electronLogger.log('Loading data into database:', folderPath, dbPath);

        return new Promise(async (resolve, reject) => {
            await logger.info('Loading data into database worker:', { folderPath, dbPath });
            electronLogger.log('Loading data into database worker:', folderPath, dbPath);
            const workerPath = path.join(__dirname, '../workers/db_worker.js');
            // In your main process
            const worker = new Worker(workerPath, {
                workerData: {
                    folderPath,
                    parsedData,
                    dbPath,
                    basePath: path.resolve(__dirname, '..'),
                    loggerContext: {
                        userEmail: globalCtx.getState().userEmail
                    }
                },
                stdout: true,
                stderr: true
            });

            worker.stdout.on('data', (data) => {
                electronLogger.log(`[Worker] ${data}`);
            });

            worker.stderr.on('data', (data) => {
                console.error(`[Worker ERROR] ${data}`);
            });

            worker.on('message', async (message) => {
                electronLogger.log('Message from worker:', message);
                if (message.success) {
                    await logger.info('Data loaded successfully:', { message });
                    electronLogger.log('Data loaded successfully:', message);
                    resolve(message);
                } else {
                    await logger.error('Error loading data:', { err: message.error });
                    console.error('Error loading data:', message.error);
                    reject(new Error(message.error));
                }
            });

            worker.on('error', async (err) => {
                await logger.error('Error in worker:', { err: err.message });
                console.error('Error in worker:', err.message);
                reject(err);
            });

            worker.on('exit', async (code) => {
                electronLogger.log('Worker exited:', code);
                if (code !== 0) {
                    await logger.error(`Worker stopped with exit code ${code}`);
                    reject(new Error(`Worker stopped with exit code ${code}`));
                } else {
                    await logger.info('Worker exited successfully.');
                    electronLogger.log('Worker exited successfully.');
                }
            });

            await logger.info('Worker created:', { workerPath });
            electronLogger.log('Worker created:', workerPath);
        }).catch((err) => {
            console.error('Error in promise:', err.message);
            return { success: false, error: err.message };
        });
    });

    // ipcMain.handle('get-data', (event, batchSize, offset, dbPath) => {});

    // ipcMain.handle('get-post', (event, postId, dbPath) => {});

    ipcMain.handle('get-post-ids-titles', async (event, dbPath) => {
        try {
            await logger.info('Getting post IDs and titles:', { dbPath });
            const db = await initDatabase(dbPath);
            const result = await getAllPostIdsAndTitles(db);
            db.close();
            await logger.info('Post IDs and titles:', { result });
            electronLogger.log('Post IDs and titles:', { result });
            return result;
        } catch (err) {
            await logger.error('Error getting post IDs and titles:', { err });
            console.error('Error getting post IDs and titles:', err.message);
            return [];
        }
    });

    ipcMain.handle('get-reddit-posts-by-batch', async (event, dbPath, batchSize, offset) => {
        try {
            await logger.info('Getting posts by batch:', { batchSize, offset });
            electronLogger.log('Getting posts by batch:', batchSize, offset);
            const db = await initDatabase(dbPath);
            const result = await loadPostsByBatch(db, batchSize, offset);
            db.close();
            await logger.info('Posts by batch:', { result });
            electronLogger.log('Posts by batch:', result);
            return result;
        } catch (err) {
            await logger.error('Error getting posts by batch:', { err });
            console.error('Error getting posts by batch:', err.message);
            return [];
        }
    });

    ipcMain.handle('get-post-by-id', async (event, postId, dbPath) => {
        try {
            await logger.info('Getting post by ID:', { postId });
            electronLogger.log('Getting post by ID:', postId);
            const db = await initDatabase(dbPath);
            const result = await getPostById(
                db,
                postId,
                ['id', 'title', 'selftext'],
                ['id', 'body', 'parent_id']
            );

            db.close();
            await logger.info('Post by ID:', { result });
            electronLogger.log('Post by ID:', result);
            return result;
        } catch (err) {
            await logger.error('Error getting post by ID:', { err });
            console.error('Error getting post by ID:', err.message);
            return [];
        }
    });
};

module.exports = {
    dbHandler
};

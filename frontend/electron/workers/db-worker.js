// worker.js

const { parentPort, workerData } = require('worker_threads');
const path = require('path');
const fs = require('fs');
const { electronLogger } = require('../utils/electron-logger');

const {
    initDatabase,
    createTables,
    insertPostsBatch,
    insertCommentsBatch
} = require('../utils/db_helpers');

const logger = require('../utils/logger');
const { createTimer } = require('../utils/timer');

const loggerContext = workerData?.loggerContext;

// Process posts and comments using batch inserts
const loadCommentsForPosts = async (folderPath, parsedData, db) => {
    try {
        await logger.info('Starting to batch insert posts and comments...', {}, loggerContext);
        electronLogger.log('Starting to batch insert posts...');

        const posts = Object.entries(parsedData).map(([postId, post]) => ({ id: postId, ...post }));
        await insertPostsBatch(db, posts, loggerContext);

        await logger.info('Posts batch inserted successfully.', {}, loggerContext);
        electronLogger.log('Posts batch inserted successfully.');

        await logger.info('Processing files for comments...', {}, loggerContext);
        electronLogger.log('Processing files for comments...');

        const files = fs
            .readdirSync(folderPath)
            .filter(
                (file) => file.endsWith('.json') && !file.startsWith('._') && file.startsWith('RC')
            );

        for (const file of files) {
            const filePath = path.join(folderPath, file);
            electronLogger.log(`Processing file: ${filePath}`);

            const content = fs.readFileSync(filePath, 'utf-8');
            const comments = JSON.parse(content).filter((item) => item.id); // Ensure items have an ID

            await insertCommentsBatch(db, comments, loggerContext);
            await logger.info(`Batch inserted comments from file: ${file}`, {}, loggerContext);
            electronLogger.log(`Batch inserted comments from file: ${file}`);
        }

        await logger.info('All comments batch inserted successfully.', {}, loggerContext);
        electronLogger.log('All comments batch inserted successfully.');
    } catch (err) {
        await logger.error(
            'Error during batch insert of posts and comments.',
            { err },
            loggerContext
        );
        electronLogger.error(err);
        throw err;
    }
};

const main = async () => {
    if (workerData) {
        const timer = createTimer();
        electronLogger.log('Worker data');

        let db;
        try {
            db = await initDatabase(workerData.dbPath, loggerContext);
            electronLogger.log('Database initialized.');

            await createTables(db, loggerContext);
            await logger.info('Tables created or already exist.', {}, loggerContext);
            electronLogger.log('Tables created or already exist.');

            await loadCommentsForPosts(workerData.folderPath, workerData.parsedData, db);

            await logger.info('All data loaded successfully.', {}, loggerContext);
            electronLogger.log('All data loaded successfully.');
        } catch (err) {
            await logger.error('Error during data load.', { err }, loggerContext);
            electronLogger.error(`Error: ${err.message}`);
            parentPort.postMessage({ success: false, error: err.message });
            if (db) {
                db.close();
            }
            return;
        }

        try {
            db.close((err) => {
                if (err) {
                    logger
                        .error(`Failed to close database: ${err.message}`, { err }, loggerContext)
                        .catch(electronLogger.error);
                    electronLogger.error(`Failed to close database: ${err.message}`);
                    parentPort.postMessage({
                        success: false,
                        error: `Failed to close database: ${err.message}`
                    });
                } else {
                    logger.info('Database closed.', {}, loggerContext).catch(electronLogger.error);
                    electronLogger.log('Database closed.');
                    parentPort.postMessage({
                        success: true,
                        message: 'Data loaded successfully.'
                    });
                }
            });
        } catch (err) {
            await logger.error('Error closing database.', { err }, loggerContext);
            electronLogger.error(`Error closing database: ${err.message}`);
            parentPort.postMessage({ success: false, error: err.message });
        }

        await logger.time(`Worker processing all data`, { time: timer.end() }, loggerContext);
    }
};

// Run the main function
main().catch((err) => {
    electronLogger.error(`Unhandled error: ${err.message}`);
    parentPort.postMessage({ success: false, error: err.message });
});

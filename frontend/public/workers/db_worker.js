const { parentPort, workerData } = require('worker_threads');
const {
    insertPostsBatch,
    insertCommentsBatch,
    createTables,
    initDatabase
} = require('../utils/db_helpers');
const fs = require('fs');
const path = require('path');

// Process posts and comments using batch inserts
const loadCommentsForPosts = async (folderPath, parsedData, db) => {
    try {
        console.log('Starting to batch insert posts...');
        const posts = Object.entries(parsedData).map(([postId, post]) => ({ id: postId, ...post }));
        await insertPostsBatch(db, posts);
        console.log('Posts batch inserted successfully.');

        console.log('Processing files for comments...');
        const files = fs
            .readdirSync(folderPath)
            .filter(
                (file) => file.endsWith('.json') && !file.startsWith('._') && file.startsWith('RC')
            );

        for (const file of files) {
            const filePath = path.join(folderPath, file);
            console.log(`Processing file: ${filePath}`);

            const content = fs.readFileSync(filePath, 'utf-8');
            const comments = JSON.parse(content).filter((item) => item.id); // Ensure items have an ID

            await insertCommentsBatch(db, comments);
            console.log(`Batch inserted comments from file: ${file}`);
        }
        console.log('All comments batch inserted successfully.');
    } catch (err) {
        console.error(err);
        throw err;
    }
};

if (workerData) {
    const db = initDatabase(workerData.dbPath);

    createTables(db)
        .then(() => {
            console.log('Tables created or already exist.');
            return loadCommentsForPosts(workerData.folderPath, workerData.parsedData, db);
        })
        .then(() => {
            console.log('All data loaded successfully.');
            db.close((err) => {
                if (err) {
                    console.error(`Failed to close database: ${err.message}`);
                    parentPort.postMessage({
                        success: false,
                        error: `Failed to close database: ${err.message}`
                    });
                } else {
                    console.log('Database closed.');
                    parentPort.postMessage({ success: true, message: 'Data loaded successfully.' });
                }
            });
        })
        .catch((err) => {
            db.close();
            console.error(`Error: ${err.message}`);
            parentPort.postMessage({ success: false, error: err.message });
        });
}

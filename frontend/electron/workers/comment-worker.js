const { parentPort } = require('worker_threads');
const fs = require('fs');
const path = require('path');
const { electronLogger } = require('../utils/electron-logger');

// Helper to omit the first element if it doesn't match the required structure
const omitFirstIfMatchesStructure = (data) => {
    if (Array.isArray(data) && data.length > 0) {
        const firstElement = data[0];
        if (!firstElement.hasOwnProperty('id')) {
            return data.slice(1);
        }
    }
    return data;
};

// Incremental file processor
const processFile = async (filePath) => {
    const chunks = [];
    return new Promise((resolve, reject) => {
        const stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', () => {
            try {
                const content = JSON.parse(chunks.join(''));
                resolve(content);
            } catch (error) {
                reject(new Error(`Failed to parse JSON from file: ${filePath}`));
            }
        });
        stream.on('error', (err) => reject(err));
    });
};

// Function to process all comments from the files
const loadCommentsForPosts = async (folderPath, parsedData) => {
    const files = fs
        .readdirSync(folderPath)
        .filter(
            (file) => file.endsWith('.json') && !file.startsWith('._') && file.startsWith('RC')
        );

    const jsonFiles = files
        .map((file) => {
            const [_, datePart] = file.split('_');
            const [year, month] = datePart.replace('.json', '').split('-');
            return {
                file,
                year: parseInt(year, 10),
                month: parseInt(month, 10)
            };
        })
        .sort((a, b) => a.year - b.year || a.month - b.month);

    const parsedFullData = {};

    for (const { file } of jsonFiles) {
        const filePath = path.join(folderPath, file);
        try {
            const data = await processFile(filePath);
            const filteredData = omitFirstIfMatchesStructure(data);

            const comments = {};
            filteredData.forEach((comment) => {
                const commentId = comment.id;
                delete comment.id;

                const commentLink = comment.link_id.split('_')[1];
                const commentParent = comment.parent_id.split('_')[1];

                if (commentParent !== commentLink && !comments[commentParent]) {
                    comments[commentParent] = { comments: {} };
                    comments[commentParent].comments[commentId] = comment;
                } else if (comments[commentParent]) {
                    comments[commentId] = { ...comments[commentId], ...comment };
                } else {
                    comments[commentId] = comment;
                }
            });

            Object.keys(parsedData).forEach((id) => {
                if (comments[id]) {
                    parsedFullData[id] = { ...parsedData[id], comments: {} };
                }
            });

            Object.keys(comments).forEach((id) => {
                const link_id = comments[id].link_id?.split('_')[1];
                if (!link_id) return;
                if (parsedFullData[link_id]) {
                    parsedFullData[link_id].comments = {
                        ...parsedFullData[link_id].comments,
                        [id]: comments[id]
                    };
                }
            });
        } catch (error) {
            console.error(`Error processing file ${file}:`, error.message);
        }
    }

    return parsedFullData;
};

// Listen for messages from the main thread
parentPort?.on('message', async ({ folderPath, parsedData }) => {
    try {
        electronLogger.log('Worker received data:', folderPath);

        const fullData = await loadCommentsForPosts(folderPath, parsedData);
        parentPort.postMessage({ fullData });
    } catch (error) {
        console.error('Error in worker:', error.message);
        parentPort.postMessage({ error: error.message });
    }
});

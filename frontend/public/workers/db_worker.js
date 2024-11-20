const { parentPort, workerData } = require('worker_threads');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Initialize SQLite database
const initDatabase = (dbPath) => {
    console.log('Database connection:', dbPath);
    return new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error(`Database connection failed: ${err.message}`);
            parentPort.postMessage({
                success: false,
                error: `Database connection failed: ${err.message}`
            });
        }
    });
};

const createTables = (db) => {
    console.log('Creating tables if they do not exist...');

    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Create `posts` table
            db.run(
                `CREATE TABLE IF NOT EXISTS posts (
                    id TEXT PRIMARY KEY,
                    over_18 INTEGER,
                    subreddit TEXT,
                    score INTEGER,
                    thumbnail TEXT,
                    permalink TEXT,
                    is_self INTEGER,
                    domain TEXT,
                    created_utc INTEGER,
                    url TEXT,
                    num_comments INTEGER,
                    title TEXT,
                    selftext TEXT,
                    author TEXT,
                    hide_score INTEGER,
                    subreddit_id TEXT
                )`,
                (err) => {
                    if (err) {
                        console.error(`Failed to create posts table: ${err.message}`);
                        reject(err);
                    }
                }
            );

            // Create `comments` table
            db.run(
                `CREATE TABLE IF NOT EXISTS comments (
                    id TEXT PRIMARY KEY,
                    controversiality INTEGER,
                    score_hidden INTEGER,
                    body TEXT,
                    score INTEGER,
                    created_utc INTEGER,
                    author TEXT,
                    parent_id TEXT,
                    subreddit_id TEXT,
                    retrieved_on INTEGER,
                    gilded INTEGER,
                    link_id TEXT,
                    subreddit TEXT,
                    parent_comment_id TEXT,
                    post_id TEXT,
                    FOREIGN KEY(post_id) REFERENCES posts(id)
                )`,
                (err) => {
                    if (err) {
                        console.error(`Failed to create comments table: ${err.message}`);
                        reject(err);
                    }
                }
            );

            // If no errors, resolve the promise
            resolve();
        });
    });
};

// Function to insert posts into SQLite
const insertPost = async (db, postId, post) => {
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT OR REPLACE INTO posts (id, over_18, subreddit, score, thumbnail, permalink, is_self, domain, created_utc, url, num_comments, title, selftext, author, hide_score, subreddit_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                postId,
                post.over_18,
                post.subreddit,
                post.score,
                post.thumbnail,
                post.permalink,
                post.is_self,
                post.domain,
                post.created_utc,
                post.url,
                post.num_comments,
                post.title,
                post.selftext,
                post.author,
                post.hide_score,
                post.subreddit_id
            ],
            (err) => {
                if (err) {
                    reject(`Failed to insert post: ${err.message}`);
                } else {
                    resolve();
                }
            }
        );
    });
};

// Function to insert comments into SQLite
const insertComment = async (db, commentId, comment, postId) => {
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT OR REPLACE INTO comments (id, body, author, created_utc, post_id)
             VALUES (?, ?, ?, ?, ?)`,
            [commentId, comment.body, comment.author, comment.created_utc, postId],
            (err) => {
                if (err) {
                    reject(`Failed to insert comment: ${err.message}`);
                } else {
                    resolve();
                }
            }
        );
    });
};

// Function to process posts and comments
const loadCommentsForPosts = async (folderPath, parsedData, db) => {
    try {
        console.log('Starting to insert posts...');
        for (const [postId, post] of Object.entries(parsedData)) {
            console.log(`Inserting post: ${postId}`);
            await insertPost(db, postId, post);
        }
        console.log('Posts inserted successfully.');

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
            const data = JSON.parse(content);

            const filteredData = data.filter((item) => item.id); // Ensure items have an ID

            for (const comment of filteredData) {
                const postId = comment.link_id.split('_')[1];
                console.log(`Inserting comment for post: ${postId}`);
                await insertComment(db, comment.id, comment, postId);
            }
        }
        console.log('Comments inserted successfully.');
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

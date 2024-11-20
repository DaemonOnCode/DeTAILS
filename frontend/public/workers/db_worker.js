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

            db.run(
                `CREATE TABLE IF NOT EXISTS comments (
                    id TEXT PRIMARY KEY,
                    body TEXT,
                    author TEXT,
                    created_utc INTEGER,
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

            resolve();
        });
    });
};

// Batch insert posts
const insertPostsBatch = async (db, posts) => {
    return new Promise((resolve, reject) => {
        const query = `INSERT OR REPLACE INTO posts 
            (id, over_18, subreddit, score, thumbnail, permalink, is_self, domain, created_utc, url, num_comments, title, selftext, author, hide_score, subreddit_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            const stmt = db.prepare(query);
            for (const post of posts) {
                stmt.run([
                    post.id,
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
                ]);
            }
            stmt.finalize((err) => {
                if (err) {
                    db.run('ROLLBACK');
                    reject(`Failed to batch insert posts: ${err.message}`);
                } else {
                    db.run('COMMIT', (commitErr) => {
                        if (commitErr) {
                            reject(`Commit failed: ${commitErr.message}`);
                        } else {
                            resolve();
                        }
                    });
                }
            });
        });
    });
};

// Batch insert comments
const insertCommentsBatch = async (db, comments) => {
    return new Promise((resolve, reject) => {
        const query = `INSERT OR REPLACE INTO comments 
            (id, body, author, created_utc, post_id)
            VALUES (?, ?, ?, ?, ?)`;

        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            const stmt = db.prepare(query);
            for (const comment of comments) {
                stmt.run([
                    comment.id,
                    comment.body,
                    comment.author,
                    comment.created_utc,
                    comment.link_id.split('_')[1] // Extract post_id from link_id
                ]);
            }
            stmt.finalize((err) => {
                if (err) {
                    db.run('ROLLBACK');
                    reject(`Failed to batch insert comments: ${err.message}`);
                } else {
                    db.run('COMMIT', (commitErr) => {
                        if (commitErr) {
                            reject(`Commit failed: ${commitErr.message}`);
                        } else {
                            resolve();
                        }
                    });
                }
            });
        });
    });
};

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

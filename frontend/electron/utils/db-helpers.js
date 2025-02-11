// db_helpers.js

const logger = require('./logger');
const sqlite3 = require('sqlite3').verbose();
const { electronLogger } = require('./electron-logger');

// Helper function to promisify db.run
const runAsync = (db, sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
};

// Helper function to promisify db.get
const getAsync = (db, sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

// Helper function to promisify db.all
const allAsync = (db, sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

// Helper function to promisify db.prepare
const prepareAsync = (db, sql) => {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare(sql, (err) => {
            if (err) reject(err);
            else resolve(stmt);
        });
    });
};

// Helper function to promisify stmt.run
const stmtRunAsync = (stmt, params = []) => {
    return new Promise((resolve, reject) => {
        stmt.run(params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
};

// Helper function to promisify stmt.finalize
const finalizeAsync = (stmt) => {
    return new Promise((resolve, reject) => {
        stmt.finalize((err) => {
            if (err) reject(err);
            else resolve();
        });
    });
};

// Initialize the database connection
const initDatabase = async (dbPath, loggerContext = {}) => {
    electronLogger.log('Database connection:', dbPath);
    await logger.info('Database connection initialized', { dbPath }, loggerContext);

    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, async (err) => {
            if (err) {
                electronLogger.error(`Database connection failed: ${err.message}`);
                await logger.error(`Database connection failed: ${err.message}`, {}, loggerContext);
                // logger
                //     .error(`Database connection failed: ${err.message}`)
                //     .finally(() => reject(err));
                reject(err);
            } else {
                electronLogger.log('Database connection successful.');
                await logger.info('Database connection successful', {}, loggerContext);
                // logger.info('Database connection successful').finally(() => resolve(db));
                resolve(db);
            }
        });
    });
};

// Create tables if they do not exist
const createTables = async (db, loggerContext = {}) => {
    electronLogger.log('Starting to create tables...');
    try {
        electronLogger.log('Logger test before creating posts table...');
        await logger.info('Creating posts table...', {}, loggerContext);
        electronLogger.log('Logger test passed.');

        await runAsync(
            db,
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
            )`
        );

        electronLogger.log('Posts table created.');

        electronLogger.log('Logger test before creating comments table...');
        await logger.info('Creating comments table...', {}, loggerContext);
        electronLogger.log('Logger test passed.');

        await runAsync(
            db,
            `CREATE TABLE IF NOT EXISTS comments (
                id TEXT PRIMARY KEY,
                body TEXT,
                author TEXT,
                created_utc INTEGER,
                post_id TEXT,
                parent_id TEXT,
                controversiality INTEGER,
                score_hidden INTEGER,
                score INTEGER,
                subreddit_id TEXT,
                retrieved_on INTEGER,
                gilded INTEGER,
                FOREIGN KEY(post_id) REFERENCES posts(id)
            )`
        );

        electronLogger.log('Comments table created.');

        await logger.info('Tables created successfully.', {}, loggerContext);
        electronLogger.log('Tables created successfully.');
    } catch (err) {
        electronLogger.error('Error while creating tables:', err);
        await logger.error(`Error while creating tables: ${err.message}`, { err }, loggerContext);
        throw err;
    }
};

// Batch insert posts
const insertPostsBatch = async (db, posts, loggerContext = {}) => {
    electronLogger.log('Inserting posts batch:', posts.length);
    await logger.info('Inserting posts batch...', {}, loggerContext);

    try {
        await runAsync(db, 'BEGIN TRANSACTION');

        const query = `INSERT OR REPLACE INTO posts 
            (id, over_18, subreddit, score, thumbnail, permalink, is_self, domain, created_utc, url, num_comments, title, selftext, author, hide_score, subreddit_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        const stmt = await prepareAsync(db, query);

        for (const post of posts) {
            await stmtRunAsync(stmt, [
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

        await finalizeAsync(stmt);
        await runAsync(db, 'COMMIT');
        await logger.info('Posts batch inserted successfully', {}, loggerContext);
    } catch (err) {
        await runAsync(db, 'ROLLBACK').catch(electronLogger.error);
        await logger.error(`Failed to batch insert posts: ${err.message}`, { err }, loggerContext);
        throw err;
    }
};

// Batch insert comments
const insertCommentsBatch = async (db, comments, loggerContext = {}) => {
    electronLogger.log('Inserting comments batch:', comments.length);
    await logger.info('Inserting comments batch...', {}, loggerContext);

    try {
        await runAsync(db, 'BEGIN TRANSACTION');

        const query = `INSERT OR REPLACE INTO comments 
            (id, body, author, created_utc, post_id, parent_id, controversiality, score_hidden, score, subreddit_id, retrieved_on, gilded)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        const stmt = await prepareAsync(db, query);

        for (const comment of comments) {
            await stmtRunAsync(stmt, [
                comment.id,
                comment.body,
                comment.author,
                comment.created_utc,
                comment.link_id.split('_')[1], // Extract post_id from link_id
                comment.parent_id ? comment.parent_id.split('_')[1] : null, // Extract parent_id
                comment.controversiality,
                comment.score_hidden ? 1 : 0,
                comment.score,
                comment.subreddit_id,
                comment.retrieved_on,
                comment.gilded
            ]);
        }

        await finalizeAsync(stmt);
        await runAsync(db, 'COMMIT');
        await logger.info('Comments batch inserted successfully', {}, loggerContext);
    } catch (err) {
        await runAsync(db, 'ROLLBACK').catch(electronLogger.error);
        await logger.error(
            `Failed to batch insert comments: ${err.message}`,
            { err },
            loggerContext
        );
        throw err;
    }
};

const loadPostsByBatch = async (db, batchSize, offset, loggerContext = {}) => {
    try {
        const posts = await allAsync(db, `SELECT *  FROM posts LIMIT ? OFFSET ?`, [
            batchSize,
            offset
        ]);

        await logger.info('Posts loaded by batch', {}, loggerContext);
        return posts;
    } catch (err) {
        await logger.error(`Error fetching posts: ${err.message}`, { err }, loggerContext);
        throw err;
    }
};

// Load posts by batch with their comments
const loadPostsWithCommentsByBatch = async (db, batchSize, offset, loggerContext = {}) => {
    try {
        const posts = await allAsync(db, `SELECT * FROM posts LIMIT ? OFFSET ?`, [
            batchSize,
            offset
        ]);

        const postsWithComments = await Promise.all(
            posts.map(async (post) => {
                const comments = await getCommentsRecursive(db, post.id);
                return {
                    ...post,
                    comments
                };
            })
        );

        await logger.info('Posts loaded by batch', {}, loggerContext);
        return postsWithComments;
    } catch (err) {
        await logger.error(`Error fetching posts: ${err.message}`, { err }, loggerContext);
        throw err;
    }
};

// Get all post IDs and titles
const getAllPostIdsAndTitles = async (db, loggerContext = {}) => {
    try {
        const rows = await allAsync(db, `SELECT id, title FROM posts`);
        await logger.info('Fetched post IDs and titles', {}, loggerContext);
        return rows;
    } catch (err) {
        await logger.error(
            `Error fetching post IDs and titles: ${err.message}`,
            { err },
            loggerContext
        );
        throw err;
    }
};

// Get post by ID with its comments
const getPostById = async (
    db,
    postId,
    postFields = ['*'],
    commentFields = ['*'],
    loggerContext = {}
) => {
    electronLogger.log('Fetching post by ID:', postId);

    try {
        const postQuery = `SELECT ${postFields.join(', ')} FROM posts WHERE id = ?`;
        const post = await getAsync(db, postQuery, [postId]);

        if (!post) {
            await logger.error(`Post with ID ${postId} not found`, {}, loggerContext);
            throw new Error(`Post with ID ${postId} not found`);
        }

        await logger.info('Post fetched by ID', {}, loggerContext);
        const comments = await getCommentsRecursive(db, postId, commentFields);

        return {
            ...post,
            comments
        };
    } catch (err) {
        await logger.error(`Error fetching post by ID: ${err.message}`, { err }, loggerContext);
        throw err;
    }
};

// Get comments recursively for a post
const getCommentsRecursive = async (db, postId, commentFields = ['*'], loggerContext = {}) => {
    electronLogger.log('Fetching comments for post:', postId);

    try {
        const commentQuery = `SELECT ${commentFields.join(', ')} FROM comments WHERE post_id = ?`;
        const comments = await allAsync(db, commentQuery, [postId]);

        await logger.info(
            `Fetched ${comments.length} comments for post ${postId}`,
            {},
            loggerContext
        );

        // Build recursive comment tree
        const map = {};
        comments.forEach((comment) => {
            map[comment.id] = { ...comment, comments: [] };
        });

        comments.forEach((comment) => {
            if (comment.parent_id && map[comment.parent_id]) {
                map[comment.parent_id].comments.push(map[comment.id]);
            }
        });

        const topLevelComments = comments
            .filter((comment) => !comment.parent_id || comment.parent_id === postId)
            .map((comment) => map[comment.id]);

        return topLevelComments;
    } catch (err) {
        await logger.error(
            `Error fetching comments for post ${postId}: ${err.message}`,
            { err, postId },
            loggerContext
        );
        throw err;
    }
};

module.exports = {
    initDatabase,
    createTables,
    insertPostsBatch,
    insertCommentsBatch,
    loadPostsByBatch,
    getAllPostIdsAndTitles,
    getPostById,
    getCommentsRecursive,
    loadPostsWithCommentsByBatch
};

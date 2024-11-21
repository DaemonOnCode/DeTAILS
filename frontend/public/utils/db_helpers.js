const sqlite3 = require('sqlite3').verbose();

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
        parent_id TEXT,
        controversiality INTEGER,
        score_hidden INTEGER,
        score INTEGER,
        subreddit_id TEXT,
        retrieved_on INTEGER,
        gilded INTEGER,
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
            (id, body, author, created_utc, post_id, parent_id, controversiality, score_hidden, score, subreddit_id, retrieved_on, gilded)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            const stmt = db.prepare(query);
            for (const comment of comments) {
                stmt.run([
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

const loadPostsByBatch = (db, batchSize, offset) => {
    return new Promise((resolve, reject) => {
        db.all(`SELECT * FROM posts LIMIT ? OFFSET ?`, [batchSize, offset], async (err, posts) => {
            if (err) {
                reject(`Error fetching posts: ${err.message}`);
                return;
            }

            // Fetch recursive comments for each post
            const postsWithComments = await Promise.all(
                posts.map(async (post) => {
                    const comments = await getCommentsRecursive(db, post.id);
                    return {
                        ...post,
                        comments
                    };
                })
            );

            resolve(postsWithComments);
        });
    });
};

const getAllPostIdsAndTitles = (db) => {
    return new Promise((resolve, reject) => {
        db.all(`SELECT id, title FROM posts`, (err, rows) => {
            if (err) {
                reject(`Error fetching post IDs and titles: ${err.message}`);
            } else {
                resolve(rows);
            }
        });
    });
};

const getPostById = async (db, postId, postFields = ['*'], commentFields = ['*']) => {
    console.log('Fetching post by ID:', postId);

    try {
        const postQuery = `SELECT ${postFields.join(', ')} FROM posts WHERE id = ?`;
        const post = await new Promise((resolve, reject) => {
            db.get(postQuery, [postId], (err, row) => {
                if (err) {
                    console.error('Error fetching post:', err.message);
                    reject(`Error fetching post with ID ${postId}: ${err.message}`);
                } else if (!row) {
                    reject(`Post with ID ${postId} not found`);
                } else {
                    resolve(row);
                }
            });
        });

        const comments = await getCommentsRecursive(db, postId, commentFields);

        return {
            ...post,
            comments
        };
    } catch (error) {
        throw new Error(error);
    }
};

const getCommentsRecursive = async (db, postId, commentFields = ['*']) => {
    console.log('Fetching comments for post:', postId);

    try {
        // Dynamically select comment fields
        const commentQuery = `SELECT ${commentFields.join(', ')} FROM comments WHERE post_id = ?`;
        const comments = await new Promise((resolve, reject) => {
            db.all(commentQuery, [postId], (err, rows) => {
                if (err) {
                    console.error(`Error fetching comments for post ${postId}: ${err.message}`);
                    reject(`Error fetching comments for post ${postId}: ${err.message}`);
                } else {
                    resolve(rows);
                }
            });
        });

        // console.log('Comments:', comments);

        // Build recursive comment tree
        const map = {};
        comments.forEach((comment) => {
            map[comment.id] = { ...comment, comments: [] };
        });

        // console.log('Comment map:', map);

        comments.forEach((comment) => {
            if (comment.parent_id && map[comment.parent_id]) {
                map[comment.parent_id].comments.push(map[comment.id]);
            }
        });

        // console.log('Comment map with replies:', map);

        const topLevelComments = comments
            .filter((comment) => postId === comment.parent_id)
            .map((comment) => map[comment.id]);

        // console.log('Top level comments:', topLevelComments);
        return topLevelComments;
    } catch (error) {
        throw new Error(error);
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
    getCommentsRecursive
};

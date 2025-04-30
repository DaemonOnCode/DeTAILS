import initSqlJs from "sql.js";

let SQL;
let database;

self.onmessage = async (e) => {
  const {
    type,
    id,
    arrayBuffer,
    query,
    params,
    page,
    pageSize,
    datasetId,
    postIds,
  } = e.data;

  if (type === "loadDatabase") {
    try {
      if (!SQL) {
        SQL = await initSqlJs({
          locateFile: (file) => `https://sql.js.org/dist/${file}`,
        });
      }
      database = new SQL.Database(new Uint8Array(arrayBuffer));
      self.postMessage({ type: "databaseLoaded", data: null, id });
    } catch (error) {
      self.postMessage({ type: "error", data: error.message, id });
    }
  } else if (type === "query") {
    try {
      let finalQuery = query;
      if (page !== undefined && pageSize !== undefined) {
        const offset = (page - 1) * pageSize;
        finalQuery = `${query} LIMIT ${pageSize} OFFSET ${offset}`;
      }
      const stmt = database.prepare(finalQuery);
      if (params) stmt.bind(params);
      const results = [];
      while (stmt.step()) results.push(stmt.getAsObject());
      stmt.free();
      self.postMessage({ type: "queryResult", data: results, id });
    } catch (error) {
      self.postMessage({ type: "error", data: error.message, id });
    }
  } else if (type === "fetchPostsAndCommentsBatch") {
    try {
      const results = await fetchPostsAndCommentsBatch(datasetId, postIds);
      self.postMessage({
        type: "fetchPostsAndCommentsBatchResult",
        data: results,
        id,
      });
    } catch (error) {
      self.postMessage({ type: "error", data: error.message, id });
    }
  }
};

async function fetchPostsAndCommentsBatch(datasetId, postIds) {
  // const countStmt = database.prepare(
  //   "SELECT COUNT(*) AS cnt FROM posts WHERE dataset_id = ?"
  // );
  // countStmt.bind([datasetId]);
  // countStmt.step();
  // countStmt.free();

  const postQuery = `
    SELECT id, selftext, title 
    FROM posts 
    WHERE dataset_id = ? AND id IN (${postIds.map(() => "?").join(",")})
  `;

  const postStmt = database.prepare(postQuery);
  postStmt.bind([datasetId, ...postIds]);
  const posts = [];
  while (postStmt.step()) {
    const row = postStmt.getAsObject();
    posts.push(row);
  }
  postStmt.free();

  const commentQuery = `
    WITH RECURSIVE comment_tree AS (
      SELECT id, body, parent_id, post_id
      FROM comments
      WHERE dataset_id = ? AND post_id IN (${postIds.map(() => "?").join(",")})
      UNION ALL
      SELECT c.id, c.body, c.parent_id, c.post_id
      FROM comments c
      INNER JOIN comment_tree ct ON c.parent_id = ct.id
      WHERE c.dataset_id = ?
    )
    SELECT * FROM comment_tree;
  `;

  const commentStmt = database.prepare(commentQuery);
  commentStmt.bind([datasetId, ...postIds, datasetId]);
  const comments = [];
  while (commentStmt.step()) {
    const row = commentStmt.getAsObject();
    comments.push(row);
  }
  commentStmt.free();

  // console.log(
  //   `DEBUG fetched ${posts.length} posts and ${comments.length} comments`
  // );

  let totalCount = 0;
  posts.forEach((post) => {
    console.log("Selftext present:", !!post.selftext, post.id);
    totalCount += !!post.selftext ? 1 : 0;
    console.log("Title present:", !!post.title, post.id);
    totalCount += !!post.title ? 1 : 0;
    let commentCount = 0;
    comments.forEach((comment) => {
      if (comment.post_id === post.id) {
        commentCount++;
      }
    });
    console.log("Comment count for post:", commentCount, post.id);
    totalCount += commentCount;
  });

  console.log("Total count of posts and comments:", totalCount, "id:", postIds);

  console.log(
    "▶️ raw comments length:",
    comments.length,
    "unique IDs:",
    new Set(comments.map((c) => c.id)).size
  );

  const commentMap = {};
  comments.forEach((comment) => {
    comment.comments = [];
    commentMap[comment.id] = comment;
  });

  const postMap = {};
  posts.forEach((post) => {
    post.comments = [];
    postMap[post.id] = post;
  });

  comments.forEach((comment) => {
    if (comment.post_id in postMap && comment.parent_id === comment.post_id) {
      postMap[comment.post_id].comments.push(comment);
    } else if (comment.parent_id in commentMap) {
      commentMap[comment.parent_id].comments.push(comment);
    }
  });

  console.log(
    `DEBUG returning ${posts.length} posts, each with nested comments`
  );
  return posts;
}

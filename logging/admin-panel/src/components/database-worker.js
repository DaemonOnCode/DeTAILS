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
  // 1) Sanity-check how many posts exist for this dataset
  const countStmt = database.prepare(
    "SELECT COUNT(*) AS cnt FROM posts WHERE dataset_id = ?"
  );
  countStmt.bind([datasetId]);
  countStmt.step();
  const { cnt } = countStmt.getAsObject();
  // console.log(`DEBUG: datasetId=${datasetId} has ${cnt} rows in posts table`);
  countStmt.free();

  // 2) Posts query
  const postQuery = `
    SELECT id, selftext, title 
    FROM posts 
    WHERE dataset_id = ? AND id IN (${postIds.map(() => "?").join(",")})
  `;
  // console.log("DEBUG postQuery:", postQuery.trim());
  // console.log("DEBUG postQuery bind params:", [datasetId, ...postIds]);

  const postStmt = database.prepare(postQuery);
  postStmt.bind([datasetId, ...postIds]);
  const posts = [];
  while (postStmt.step()) {
    const row = postStmt.getAsObject();
    console.log("DEBUG fetched post row:", row);
    posts.push(row);
  }
  postStmt.free();

  // 3) Comments recursive query
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
  // console.log("DEBUG commentQuery:", commentQuery.trim());
  // console.log("DEBUG commentQuery bind params:", [
  //   datasetId,
  //   ...postIds,
  //   datasetId,
  // ]);

  const commentStmt = database.prepare(commentQuery);
  commentStmt.bind([datasetId, ...postIds, datasetId]);
  const comments = [];
  while (commentStmt.step()) {
    const row = commentStmt.getAsObject();
    // console.log("DEBUG fetched comment row:", row);
    comments.push(row);
  }
  commentStmt.free();

  // 4) Reconstruct tree
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

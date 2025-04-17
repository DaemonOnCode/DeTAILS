import initSqlJs from "sql.js";

let SQL;
let database;

self.onmessage = async (e) => {
  console.log("Worker received:", e.data);
  const { type, arrayBuffer, query, params, page, pageSize, queryId } = e.data;

  if (type === "loadDatabase") {
    try {
      if (!SQL) {
        console.log("Initializing sql.js...");
        SQL = await initSqlJs({
          locateFile: (file) => `https://sql.js.org/dist/${file}`,
        });
        console.log("sql.js initialized");
      }
      console.log("ArrayBuffer size:", arrayBuffer.byteLength);
      database = new SQL.Database(new Uint8Array(arrayBuffer));
      console.log("Database loaded");
      self.postMessage({ type: "databaseLoaded", data: null });
    } catch (error) {
      console.error("Worker error:", error);
      self.postMessage({ type: "error", data: error.message });
    }
  } else if (type === "query") {
    try {
      let finalQuery = query;
      // Only apply pagination if page and pageSize are explicitly provided
      if (page !== undefined && pageSize !== undefined) {
        const offset = (page - 1) * pageSize;
        finalQuery = `${query} LIMIT ${pageSize} OFFSET ${offset}`;
      }
      // Prepare the statement to support parameters
      const stmt = database.prepare(finalQuery);
      if (params) {
        stmt.bind(params);
      }
      // Collect results
      const results = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      console.log("Query results:", results);
      self.postMessage({ type: "queryResult", data: results, queryId });
    } catch (error) {
      console.error("Query error:", error);
      self.postMessage({ type: "error", data: error.message, queryId });
    }
  }
};

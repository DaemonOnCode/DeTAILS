import { useState, useEffect, useRef, JSX } from "react";
import { useDatabase } from "./database-context";

// **Type Definitions**
interface DatabaseRow {
  id: number;
  created_at: string;
  state: string;
  context: string;
}

interface FunctionOption {
  value: string;
  label: string;
}

// **Utility Function**
const toTitleCase = (str: string): string => {
  return str
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

function Timeline() {
  const { isDatabaseLoaded, executeQuery } = useDatabase();

  // **Typed State Variables**
  const [entries, setEntries] = useState<DatabaseRow[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [initialLoadComplete, setInitialLoadComplete] =
    useState<boolean>(false);
  const [filterFunction, setFilterFunction] = useState<string | null>(null);
  const [uniqueFunctions, setUniqueFunctions] = useState<FunctionOption[]>([]);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // **Database Check**
  if (!isDatabaseLoaded) {
    return <p className="p-4">Please select a database first.</p>;
  }

  // **Fetch Unique Functions**
  useEffect(() => {
    if (isDatabaseLoaded) {
      const fetchUniqueFunctions = async () => {
        try {
          const query = `
            SELECT DISTINCT json_extract(context, '$.function') AS function_name
            FROM state_dumps
            WHERE json_extract(context, '$.function') IS NOT NULL
          `;
          const result = await executeQuery(query, []);
          const functions: FunctionOption[] = result
            .map((row: any) => ({
              value: row.function_name,
              label: toTitleCase(row.function_name),
            }))
            .sort((a: FunctionOption, b: FunctionOption) =>
              a.label.localeCompare(b.label)
            );
          setUniqueFunctions(functions);
        } catch (error) {
          console.error("Error fetching unique functions:", error);
        }
      };
      fetchUniqueFunctions();
    }
  }, [isDatabaseLoaded, executeQuery]);

  // **Reset and Reload on Filter Change**
  useEffect(() => {
    setEntries([]);
    setCurrentPage(0);
    setHasMore(true);
    setInitialLoadComplete(false);
    loadMore();
  }, [filterFunction]);

  // **Load More Entries**
  const loadMore = async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const query = filterFunction
        ? `SELECT * FROM state_dumps WHERE json_extract(context, '$.function') = ? ORDER BY id`
        : `SELECT * FROM state_dumps ORDER BY id`;
      const params = filterFunction ? [filterFunction] : [];
      const newEntries: DatabaseRow[] = await executeQuery(
        query,
        params,
        currentPage,
        20
      );
      setEntries((prev) => [...prev, ...newEntries]);
      if (newEntries.length === 20) {
        setCurrentPage((prev) => prev + 1);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
      setInitialLoadComplete(true);
    }
  };

  // **Infinite Scrolling**
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loading) {
        loadMore();
      }
    });
    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current);
    }
    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [hasMore, loading]);

  // **Recursive JSON Rendering**
  const renderJsonRecursive = (data: any, depth: number = 0): JSX.Element => {
    if (depth > 5) {
      return <span>...</span>;
    }
    if (typeof data === "object" && data !== null) {
      if (Array.isArray(data)) {
        return (
          <ul className="list-disc pl-5">
            {data.map((item, index) => (
              <li key={index}>{renderJsonRecursive(item, depth + 1)}</li>
            ))}
          </ul>
        );
      } else {
        return (
          <div className="pl-4">
            {Object.entries(data).map(([key, value]) => (
              <div key={key}>
                <strong>{key}:</strong> {renderJsonRecursive(value, depth + 1)}
              </div>
            ))}
          </div>
        );
      }
    } else {
      return (
        <span>{typeof data === "string" ? data : JSON.stringify(data)}</span>
      );
    }
  };

  // **JSON Rendering with Error Handling**
  const renderJson = (jsonString: string): JSX.Element => {
    try {
      const parsed = JSON.parse(jsonString);
      return renderJsonRecursive(parsed);
    } catch (error: any) {
      return (
        <p className="text-red-500 text-sm">Invalid JSON: {error.message}</p>
      );
    }
  };

  // **JSX Rendering**
  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">Timeline</h1>
      <div className="mb-4">
        <label htmlFor="function-filter" className="mr-2">
          Filter by function:
        </label>
        <select
          id="function-filter"
          value={filterFunction || "all"}
          onChange={(e) =>
            setFilterFunction(e.target.value === "all" ? null : e.target.value)
          }
          className="p-2 border rounded"
        >
          <option value="all">All Functions</option>
          {uniqueFunctions.map((func) => (
            <option key={func.value} value={func.value}>
              {func.label}
            </option>
          ))}
        </select>
      </div>
      {initialLoadComplete && entries.length === 0 && !loading && !hasMore && (
        <p className="text-center text-gray-600">
          {filterFunction
            ? "No entries match the selected function."
            : "No entries found."}
        </p>
      )}
      <div className="space-y-4">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="bg-white p-4 rounded-lg shadow-md border border-gray-200"
          >
            <p className="text-sm text-gray-500 mb-2">
              {new Date(entry.created_at).toLocaleString()}
            </p>
            <details className="mb-2">
              <summary className="font-semibold text-gray-700 cursor-pointer hover:text-gray-900">
                State
              </summary>
              {renderJson(entry.state)}
            </details>
            <details>
              <summary className="font-semibold text-gray-700 cursor-pointer hover:text-gray-900">
                Context
              </summary>
              {renderJson(entry.context)}
            </details>
          </div>
        ))}
      </div>
      <div ref={sentinelRef} className="h-1" />
      {loading && (
        <p className="text-center text-gray-600 mt-4">Loading more...</p>
      )}
      {!hasMore && entries.length > 0 && (
        <p className="text-center text-gray-600 mt-4">
          No more entries to load.
        </p>
      )}
    </div>
  );
}

export default Timeline;

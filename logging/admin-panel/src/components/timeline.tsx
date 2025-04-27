import { useState, useEffect, useRef, JSX } from "react";
import { useDatabase } from "./context";

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

  // **State Variables**
  const [entries, setEntries] = useState<DatabaseRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [filterFunction, setFilterFunction] = useState<string | null>(null);
  const [uniqueFunctions, setUniqueFunctions] = useState<FunctionOption[]>([]);
  const [loadedEntries, setLoadedEntries] = useState<Set<number>>(new Set()); // Tracks loaded entry IDs
  const observerRef = useRef<IntersectionObserver | null>(null);

  // **Database Check**
  if (!isDatabaseLoaded) {
    return <p className="p-4">Please select a database first.</p>;
  }

  // **Fetch Unique Functions for Filter**
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

  // **Fetch All Entries Initially**
  useEffect(() => {
    const fetchAllEntries = async () => {
      setLoading(true);
      try {
        let query = `SELECT * FROM state_dumps`;
        let params: string[] = [];
        if (filterFunction) {
          query += ` WHERE json_extract(context, '$.function') = ?`;
          params.push(filterFunction);
        }
        query += ` ORDER BY id`;
        const result = await executeQuery(query, params);
        setEntries(result);
      } catch (error) {
        console.error("Error fetching entries:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchAllEntries();
  }, [filterFunction, executeQuery]);

  // **Set Up Intersection Observer**
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        setLoadedEntries((prev) => {
          const newLoaded = new Set(prev);
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const id = Number(entry.target.getAttribute("data-id"));
              newLoaded.add(id);
            }
            // Note: We don’t remove IDs when entry.isIntersecting is false
          });
          return newLoaded;
        });
      },
      { threshold: 0 } // Trigger when any part of the element is visible
    );

    // Clean up observer on unmount
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  // **Callback Ref to Observe Each Entry**
  const observeElement = (id: number) => (element: HTMLDivElement | null) => {
    if (element && observerRef.current) {
      observerRef.current.observe(element);
    }
  };

  // **Recursive JSON Rendering**
  const renderJsonRecursive = (data: any, depth: number = 0): JSX.Element => {
    if (depth > 5) return <span>...</span>;
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
    }
    return (
      <span>{typeof data === "string" ? data : JSON.stringify(data)}</span>
    );
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
      {loading && (
        <p className="text-center text-gray-600">Loading entries...</p>
      )}
      {!loading && entries.length === 0 && (
        <p className="text-center text-gray-600">
          {filterFunction
            ? "No entries match the selected function."
            : "No entries found."}
        </p>
      )}
      <div className="space-y-4">
        {entries.map((entry) => {
          const isLoaded = loadedEntries.has(entry.id);
          return (
            <div
              key={entry.id}
              data-id={entry.id} // Used by Intersection Observer
              ref={observeElement(entry.id)} // Observe this element
              className="bg-white p-4 rounded-lg shadow-md border border-gray-200"
            >
              <p className="text-sm text-gray-500 mb-2">
                {new Date(entry.created_at).toLocaleString()}
              </p>
              <details className="mb-2">
                <summary className="font-semibold text-gray-700 cursor-pointer hover:text-gray-900">
                  State
                </summary>
                {isLoaded ? (
                  renderJson(entry.state)
                ) : (
                  <p className="text-gray-400">Loading state...</p>
                )}
              </details>
              <details>
                <summary className="font-semibold text-gray-700 cursor-pointer hover:text-gray-900">
                  Context
                </summary>
                {isLoaded ? (
                  renderJson(entry.context)
                ) : (
                  <p className="text-gray-400">Loading context...</p>
                )}
              </details>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Timeline;

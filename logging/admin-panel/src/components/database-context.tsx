import { useState, useEffect, useRef } from "react";
import { createContext, useContext } from "react";

interface DatabaseContextType {
  loadDatabase: (file: File) => void;
  executeQuery: (
    query: string,
    params?: any[],
    page?: number,
    pageSize?: number
  ) => Promise<any>;
  isLoading: boolean;
  isDatabaseLoaded: boolean;
  error: string | null;
  loadedFileName: string | null; // Added to track the loaded file name
}

export const DatabaseContext = createContext<DatabaseContextType>({
  loadDatabase: () => {},
  executeQuery: async () => {},
  isLoading: false,
  isDatabaseLoaded: false,
  error: null,
  loadedFileName: null, // Default value
});

export const useDatabase = () => useContext(DatabaseContext);

export const DatabaseProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [worker, setWorker] = useState<Worker | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDatabaseLoaded, setIsDatabaseLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null); // New state
  const queryResolvers = useRef(
    new Map<
      number,
      { resolve: (value: any) => void; reject: (reason: any) => void }
    >()
  );
  const queryIdRef = useRef(0);

  useEffect(() => {
    const dbWorker = new Worker(
      new URL("./database-worker.js", import.meta.url),
      { type: "module" }
    );
    setWorker(dbWorker);

    dbWorker.onmessage = (e: MessageEvent<any>) => {
      console.log("Main thread received:", e.data);
      const { type, data, queryId } = e.data;
      if (type === "databaseLoaded") {
        setIsDatabaseLoaded(true);
        setIsLoading(false);
      } else if (type === "queryResult" && queryId !== undefined) {
        queryResolvers.current.get(queryId)?.resolve(data);
        queryResolvers.current.delete(queryId);
      } else if (type === "error") {
        if (queryId !== undefined) {
          queryResolvers.current.get(queryId)?.reject(data);
          queryResolvers.current.delete(queryId);
        } else {
          setError(data);
          setIsLoading(false);
          setIsDatabaseLoaded(false);
          setLoadedFileName(null); // Reset on error
        }
      }
    };

    return () => dbWorker.terminate();
  }, []);

  const loadDatabase = (file: File) => {
    if (!worker) return;
    setIsLoading(true);
    setError(null);
    setIsDatabaseLoaded(false);
    setLoadedFileName(null); // Reset until load succeeds
    const reader = new FileReader();
    reader.onload = (e) => {
      const arrayBuffer = e.target?.result as ArrayBuffer;
      console.log("ArrayBuffer read:", arrayBuffer);
      if (arrayBuffer) {
        worker.postMessage({ type: "loadDatabase", arrayBuffer });
        setLoadedFileName(file.name); // Set file name on successful read
      } else {
        setError("Failed to read file");
        setIsLoading(false);
      }
    };
    reader.onerror = () => {
      setError("Error reading file");
      setIsLoading(false);
    };
    reader.readAsArrayBuffer(file);
  };

  const executeQuery = (
    query: string,
    params?: any[],
    page?: number,
    pageSize?: number
  ) => {
    return new Promise((resolve, reject) => {
      if (!worker) return reject("Worker not initialized");
      if (!isDatabaseLoaded) return reject("Database not loaded");
      const queryId = queryIdRef.current++;
      queryResolvers.current.set(queryId, { resolve, reject });
      worker.postMessage({
        type: "query",
        query,
        params,
        queryId,
        page,
        pageSize,
      });
    });
  };

  const value = {
    loadDatabase,
    executeQuery,
    isLoading,
    isDatabaseLoaded,
    error,
    loadedFileName, // Include in context value
  };

  return (
    <DatabaseContext.Provider value={value}>
      {children}
    </DatabaseContext.Provider>
  );
};

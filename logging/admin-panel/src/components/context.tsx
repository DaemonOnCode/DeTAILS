import React, {
  useState,
  useEffect,
  useRef,
  createContext,
  useContext,
  RefObject,
} from "react";
import { SignJWT, importPKCS8 } from "jose";
import WorkerPool from "./worker-pool";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPES = ["https://www.googleapis.com/auth/cloud-platform"];

/** Exchange a Google service‐account JWT for an OAuth2 access token */
export async function getGcpAccessToken(creds: Record<string, string>) {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;
  const pk = await importPKCS8(creds.private_key, "RS256");
  const jwt = await new SignJWT({
    iss: creds.client_email,
    scope: SCOPES.join(" "),
    aud: TOKEN_URL,
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuedAt(iat)
    .setExpirationTime(exp)
    .sign(pk);

  const params = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: jwt,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${err}`);
  }
  const { access_token } = await res.json();
  return access_token;
}

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
  loadedFileName: string | null;
  workspaceIds: string[];
  selectedWorkspaceId: string | null;
  setSelectedWorkspaceId: (id: string) => void;
  loadApiKey: (file: File) => void;
  isApiKeyLoaded: boolean;
  apiKeyError: string | null;
  calculateSimilarity: (text1: string, text2: string) => Promise<number>;
  workerPoolRef: RefObject<WorkerPool>;
}

export const DatabaseContext = createContext<DatabaseContextType>({
  loadDatabase: () => {},
  executeQuery: async () => [],
  isLoading: false,
  isDatabaseLoaded: false,
  error: null,
  loadedFileName: null,
  workspaceIds: [],
  selectedWorkspaceId: null,
  setSelectedWorkspaceId: () => {},
  loadApiKey: () => {},
  isApiKeyLoaded: false,
  apiKeyError: null,
  calculateSimilarity: async () => 0,
  workerPoolRef: { current: null! },
});

export const useDatabase = () => useContext(DatabaseContext);

export const DatabaseProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isDatabaseLoaded, setIsDatabaseLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null);
  const [workspaceIds, setWorkspaceIds] = useState<string[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(
    null
  );
  const [apiKeyCreds, setApiKeyCreds] = useState<any>(null);
  const [isApiKeyLoaded, setIsApiKeyLoaded] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);

  const workerPoolRef = useRef(
    new WorkerPool(new URL("./database-worker.js", import.meta.url).href, 4)
  );

  useEffect(() => {
    workerPoolRef.current = new WorkerPool(
      new URL("./database-worker.js", import.meta.url).href,
      4
    );
    return () => {
      workerPoolRef.current.terminate();
    };
  }, []);

  const loadDatabase = async (file: File) => {
    setIsLoading(true);
    setError(null);
    setIsDatabaseLoaded(false);
    setLoadedFileName(null);
    setWorkspaceIds([]);
    setSelectedWorkspaceId(null);

    try {
      const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(file);
      });

      // Broadcast the “loadDatabase” message to all workers
      await workerPoolRef.current.broadcastInit(
        { type: "loadDatabase", arrayBuffer },
        {
          responseType: "databaseLoaded",
          errorType: "error",
          transferable: [arrayBuffer],
        }
      );

      setLoadedFileName(file.name);
      setIsDatabaseLoaded(true);
    } catch (err) {
      console.error("Failed to load database:", err);
      setError("Failed to load database");
    } finally {
      setIsLoading(false);
    }
  };

  /** Run any SQL query in a single available worker */
  const executeQuery = async (
    query: string,
    params?: any[],
    page?: number,
    pageSize?: number
  ) => {
    try {
      return await workerPoolRef.current.runTask(
        {
          type: "query",
          query,
          params,
          page,
          pageSize,
        },
        {
          responseType: "queryResult",
          errorType: "error",
        }
      );
    } catch (err) {
      console.error("Query failed:", err);
      throw err;
    }
  };

  /** Once DB is loaded, fetch all distinct workspace_ids */
  useEffect(() => {
    if (!isDatabaseLoaded) return;

    (
      executeQuery(
        "SELECT DISTINCT json_extract(context, '$.workspace_id') AS workspace_id FROM state_dumps"
      ) as Promise<any[]>
    )
      .then((rows: any[]) => {
        const ids = rows
          .map((r) => r.workspace_id?.toString())
          .filter((id): id is string => !!id);
        setWorkspaceIds(ids);
        if (ids.length > 0) {
          setSelectedWorkspaceId(ids[0]);
        }
      })
      .catch((err) => {
        console.error("Error fetching workspace IDs:", err);
        setError("Failed to fetch workspace IDs");
      });
  }, [isDatabaseLoaded]);

  /** Load a Google service‐account JSON key */
  const loadApiKey = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = JSON.parse(e.target?.result as string);
        if (content.client_email && content.private_key && content.project_id) {
          setApiKeyCreds(content);
          setIsApiKeyLoaded(true);
          setApiKeyError(null);
        } else {
          setApiKeyError("Invalid service account JSON");
        }
      } catch {
        setApiKeyError("Invalid JSON file");
      }
    };
    reader.onerror = () => setApiKeyError("Error reading file");
    reader.readAsText(file);
  };

  /** Compute cosine dot‐product of two text embeddings via Vertex AI */
  const calculateSimilarity = async (text1: string, text2: string) => {
    if (!apiKeyCreds) throw new Error("API key not loaded");
    const accessToken = await getGcpAccessToken(apiKeyCreds);
    const projectId = apiKeyCreds.project_id;
    const location = "us-central1";
    const model = "text-embedding-005";
    const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:predict`;

    const headers = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };

    const fetchEmbedding = async (content: string) => {
      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({ instances: [{ content }] }),
      });
      const json = await res.json();
      if (!json.predictions?.[0]?.embeddings?.values) {
        throw new Error("Embedding error");
      }
      return json.predictions[0].embeddings.values as number[];
    };

    const [e1, e2] = await Promise.all([
      fetchEmbedding(text1),
      fetchEmbedding(text2),
    ]);

    // cosine dot‐product
    return e1.reduce((sum, v, i) => sum + v * e2[i], 0);
  };

  const value: DatabaseContextType = {
    loadDatabase,
    executeQuery,
    isLoading,
    isDatabaseLoaded,
    error,
    loadedFileName,
    workspaceIds,
    selectedWorkspaceId,
    setSelectedWorkspaceId,
    loadApiKey,
    isApiKeyLoaded,
    apiKeyError,
    calculateSimilarity,
    workerPoolRef,
  };

  return (
    <DatabaseContext.Provider value={value}>
      {children}
    </DatabaseContext.Provider>
  );
};

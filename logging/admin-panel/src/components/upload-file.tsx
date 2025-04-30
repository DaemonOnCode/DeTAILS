import { ChangeEvent } from "react";
import { useDatabase } from "./context";

function SelectDBFile() {
  const {
    loadDatabase,
    isDatabaseLoaded,
    isLoading,
    error,
    loadedFileName,
    workspaceIds,
    selectedWorkspaceId,
    setSelectedWorkspaceId,
    loadApiKey,
    isApiKeyLoaded,
    apiKeyError,
  } = useDatabase();

  const handleDbFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      loadDatabase(file);
    }
  };

  const handleApiKeyFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      loadApiKey(file);
    }
  };

  return (
    <>
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Select DB File</h1>
        <input
          type="file"
          accept=".db,.sqlite"
          onChange={handleDbFileChange}
          className="mb-4"
        />
        {isLoading ? (
          <p>Loading database...</p>
        ) : error ? (
          <p className="text-red-500">Error: {error}</p>
        ) : isDatabaseLoaded ? (
          <p>Database loaded: {loadedFileName}</p>
        ) : (
          <p>Please select a database file.</p>
        )}
      </div>
      <div className="p-4">
        <h2 className="text-xl font-bold mb-2">Select Workspace</h2>
        <select
          value={selectedWorkspaceId || ""}
          onChange={(e) => setSelectedWorkspaceId(e.target.value)}
          className="border p-2 rounded"
        >
          <option value="">Select a workspace</option>
          {workspaceIds.map((id) => (
            <option key={id} value={id}>
              Workspace {id}
            </option>
          ))}
        </select>
      </div>
      <div className="p-4">
        <h2 className="text-xl font-bold mb-2">Upload API Key</h2>
        <input
          type="file"
          accept=".json"
          onChange={handleApiKeyFileChange}
          className="mb-4"
        />
        {isApiKeyLoaded ? (
          <p>API key loaded</p>
        ) : apiKeyError ? (
          <p className="text-red-500">Error: {apiKeyError}</p>
        ) : (
          <p>Please select an API key file.</p>
        )}
      </div>
    </>
  );
}

export default SelectDBFile;

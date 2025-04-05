import { ChangeEvent } from "react";
import { useDatabase } from "./database-context";

function SelectDBFile() {
  const { loadDatabase, isDatabaseLoaded, isLoading, error, loadedFileName } =
    useDatabase();

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      loadDatabase(file);
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Select DB File</h1>
      <input
        type="file"
        accept=".db,.sqlite"
        onChange={handleFileChange}
        className="mb-4"
      />
      {isLoading ? (
        <p>Loading database...</p>
      ) : error ? (
        <p className="text-red-500">Error: {error}</p>
      ) : isDatabaseLoaded ? (
        <p>Database loaded: {loadedFileName}</p> // Display the loaded file name
      ) : (
        <p>Please select a database file.</p>
      )}
    </div>
  );
}

export default SelectDBFile;

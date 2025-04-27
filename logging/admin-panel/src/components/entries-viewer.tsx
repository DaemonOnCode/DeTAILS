import { useState, useEffect, useMemo } from "react";
import { useDatabase } from "./context";
import { diff } from "../utils/diff";

interface DatabaseRow {
  id: number;
  created_at: string;
  state: string;
  context: string;
}

interface EntriesViewerProps {
  title: string;
  functionName: string;
  getComparisonData: (state: any) => any;
  propertyKeys?: string[];
  includeRun?: boolean;
}

const computeCosineSimilarity = (vec1: number[], vec2: number[]): number => {
  const dotProduct = vec1.reduce((sum, v, i) => sum + v * vec2[i], 0);
  const norm1 = Math.sqrt(vec1.reduce((sum, v) => sum + v * v, 0));
  const norm2 = Math.sqrt(vec2.reduce((sum, v) => sum + v * v, 0));
  if (norm1 === 0 || norm2 === 0) return 0;
  return dotProduct / (norm1 * norm2);
};

const fetchEmbedding = async (text: string): Promise<number[]> => {
  console.log(`Fetching embedding for: ${text}`);
  return new Array(768).fill(0);
};

function EntriesViewer({
  title,
  functionName,
  getComparisonData,
  propertyKeys = [],
  includeRun = true,
}: EntriesViewerProps) {
  const { isDatabaseLoaded, executeQuery } = useDatabase();
  const [entries, setEntries] = useState<DatabaseRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchEntries = async () => {
      setIsLoading(true);
      try {
        const query = `
          SELECT * FROM state_dumps
          WHERE json_extract(context, '$.function') IN ('${functionName}', 'save_state')
          ORDER BY id
        `;
        const result = await executeQuery(query, []);
        setEntries(result);
      } catch (error) {
        console.error("Error fetching entries:", error);
        setEntries([]);
      } finally {
        setIsLoading(false);
      }
    };

    if (isDatabaseLoaded) {
      fetchEntries();
    } else {
      setIsLoading(false);
    }
  }, [isDatabaseLoaded, executeQuery, functionName]);

  const adjacentDiffs = useMemo(() => {
    if (entries.length < 2) return [];
    return entries.slice(1).map((entry, index) => {
      const prevEntry = entries[index];
      try {
        const state1 = JSON.parse(prevEntry.state);
        const state2 = JSON.parse(entry.state);
        const data1 = getComparisonData(state1);
        const data2 = getComparisonData(state2);
        return diff(data1, data2);
      } catch (error) {
        console.error("Error parsing JSON or computing diff:", error);
        return [];
      }
    });
  }, [entries, getComparisonData]);

  const metrics = useMemo(() => {
    if (adjacentDiffs.length < 2) return [];

    const allPaths = new Set<string>();
    adjacentDiffs.forEach((diffArray) => {
      diffArray.forEach((d) => allPaths.add(d.path));
    });
    const pathArray = Array.from(allPaths);

    const diffVectors = adjacentDiffs.map((diffArray) => {
      const editedPaths = new Set(diffArray.map((d) => d.path));
      return pathArray.map((path) => (editedPaths.has(path) ? 1 : 0));
    });

    return adjacentDiffs.slice(1).map((_, index) => {
      const prevDiff = adjacentDiffs[index];
      const currDiff = adjacentDiffs[index + 1];
      const prevPaths = new Set(prevDiff.map((d) => d.path));
      const currPaths = new Set(currDiff.map((d) => d.path));

      const intersection = new Set(
        [...prevPaths].filter((path) => currPaths.has(path))
      );

      const precision =
        currPaths.size > 0 ? intersection.size / currPaths.size : 0;
      const recall =
        prevPaths.size > 0 ? intersection.size / prevPaths.size : 0;

      const vec1 = diffVectors[index];
      const vec2 = diffVectors[index + 1];
      const cosineSimilarity = computeCosineSimilarity(vec1, vec2);

      const weightedPrecision = precision * cosineSimilarity;
      const weightedRecall = recall * cosineSimilarity;

      return {
        precision,
        recall,
        cosineSimilarity,
        weightedPrecision,
        weightedRecall,
      };
    });
  }, [adjacentDiffs]);

  const propertyCosineSimilarities = useMemo(() => {
    if (entries.length < 2 || propertyKeys.length === 0) return [];

    const computeSimilarities = async () => {
      const similarities = [];
      for (let index = 1; index < entries.length; index++) {
        const prevEntry = entries[index - 1];
        const currEntry = entries[index];
        try {
          const state1 = JSON.parse(prevEntry.state);
          const state2 = JSON.parse(currEntry.state);
          const data1 = getComparisonData(state1);
          const data2 = getComparisonData(state2);

          const propertySimilarities = await Promise.all(
            propertyKeys.map(async (key) => {
              const value1 = String(data1[key] || "");
              const value2 = String(data2[key] || "");
              const embedding1 = await fetchEmbedding(value1);
              const embedding2 = await fetchEmbedding(value2);
              return computeCosineSimilarity(embedding1, embedding2);
            })
          );
          similarities.push(propertySimilarities);
        } catch (error) {
          console.error("Error computing cosine similarity:", error);
          similarities.push(propertyKeys.map(() => 0));
        }
      }
      return similarities;
    };
    computeSimilarities().then((result) => result);
    return entries.slice(1).map(() => propertyKeys.map(() => null));
  }, [entries, getComparisonData, propertyKeys]);

  const safeParseContext = (context: string) => {
    try {
      return JSON.parse(context);
    } catch (error) {
      return { function: "Unknown" };
    }
  };

  if (isLoading) {
    return <p className="p-4">Loading entries...</p>;
  }

  if (!isDatabaseLoaded) {
    return <p className="p-4">Please select a database first.</p>;
  }

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">{title}</h1>
      {entries.length === 0 ? (
        <p className="text-gray-600">No entries found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-auto w-full border-collapse border border-gray-300">
            <thead>
              <tr>
                <th className="p-2 border bg-gray-100">Entry</th>
                <th className="p-2 border bg-gray-100">
                  Differences with Previous Entry
                </th>
                <th className="p-2 border bg-gray-100">Number of Edits</th>
                <th className="p-2 border bg-gray-100">Weighted Precision</th>
                <th className="p-2 border bg-gray-100">Weighted Recall</th>
                <th className="p-2 border bg-gray-100">
                  Cosine Similarity (Diffs)
                </th>
                {propertyKeys.map((key) => (
                  <th key={key} className="p-2 border bg-gray-100">
                    Cosine Similarity ({key})
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => {
                const context = safeParseContext(entry.context);
                const entryText = includeRun
                  ? `ID: ${entry.id} - Function: ${context.function} - Run: ${
                      context.run ?? "N/A"
                    } - ${new Date(
                      entry.created_at
                    ).toLocaleString()} - Time taken: ${
                      context.time_taken ?? "N/A"
                    }`
                  : `ID: ${entry.id} - Function: ${
                      context.function
                    } - ${new Date(
                      entry.created_at
                    ).toLocaleString()} - Time taken: ${
                      context.time_taken?.toFixed(2) ?? "N/A"
                    } seconds`;
                return (
                  <tr key={entry.id}>
                    <td className="p-2 border">{entryText}</td>
                    <td className="p-2 border">
                      {index > 0 ? (
                        adjacentDiffs[index - 1].length > 0 ? (
                          <ul className="list-disc pl-5 space-y-1">
                            {adjacentDiffs[index - 1].map((diff, idx) => (
                              <li key={idx} className="text-sm">
                                {diff.type === "added" && (
                                  <span className="text-green-600">
                                    Added at <code>{diff.path}</code>:{" "}
                                    <code>{JSON.stringify(diff.newValue)}</code>
                                  </span>
                                )}
                                {diff.type === "removed" && (
                                  <span className="text-red-600">
                                    Removed from <code>{diff.path}</code>:{" "}
                                    <code>{JSON.stringify(diff.oldValue)}</code>
                                  </span>
                                )}
                                {diff.type === "changed" && (
                                  <span className="text-blue-600">
                                    Changed at <code>{diff.path}</code>: from{" "}
                                    <code>{JSON.stringify(diff.oldValue)}</code>{" "}
                                    to{" "}
                                    <code>{JSON.stringify(diff.newValue)}</code>
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-gray-600">No differences</p>
                        )
                      ) : (
                        <p className="text-gray-600">No previous entry</p>
                      )}
                    </td>
                    <td className="p-2 border">
                      {index > 0 ? adjacentDiffs[index - 1].length : "N/A"}
                    </td>
                    <td className="p-2 border">
                      {index >= 2 && metrics[index - 2]
                        ? metrics[index - 2].weightedPrecision.toFixed(3)
                        : "N/A"}
                    </td>
                    <td className="p-2 border">
                      {index >= 2 && metrics[index - 2]
                        ? metrics[index - 2].weightedRecall.toFixed(3)
                        : "N/A"}
                    </td>
                    <td className="p-2 border">
                      {index >= 2 && metrics[index - 2]
                        ? metrics[index - 2].cosineSimilarity.toFixed(3)
                        : "N/A"}
                    </td>
                    {propertyKeys.map((key, keyIndex) => (
                      <td key={key} className="p-2 border">
                        {index > 0 &&
                        propertyCosineSimilarities[index - 1][keyIndex] !== null
                          ? (
                              propertyCosineSimilarities[index - 1][keyIndex] ??
                              0
                            ).toFixed(3)
                          : "N/A"}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default EntriesViewer;

import { useState, useEffect } from "react";
import { useDatabase } from "./context";
import { DatabaseRow } from "../utils/types";

interface RateData {
  postId: string;
  initialCount: number;
  removedByHallucinations: number;
  removedByEmptyColumns: number;
  removedByDuplicates: number;
  finalCount: number;
  errorRate: number;
}

interface ErrorRateData {
  individual: RateData[];
  total: {
    input: number;
    output: number;
    error_rate: number;
    codedPostCount: number;
  };
  group_rates: Record<string, RateData>;
}

function ErrorRates() {
  const { isDatabaseLoaded, executeQuery, selectedWorkspaceId } = useDatabase();
  const [errorRates, setErrorRates] = useState<
    Record<string, Record<string, ErrorRateData>>
  >({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStateDumps = async () => {
      if (!isDatabaseLoaded) return;

      setIsLoading(true);
      try {
        const query = `
          SELECT * FROM state_dumps
          WHERE (json_extract(context, '$.parent_function_name') IN ('generate-initial-codes', 'final-coding', 'generate-deductive-codes', 'redo-initial-coding', 'redo-final-coding')
          OR json_extract(context, '$.function') IN ('initial_codes', 'final_codes', 'generate_deductive_codes'))
          AND json_extract(context, '$.workspace_id') = ?
          ORDER BY id
        `;
        const allDumps = await executeQuery(query, [selectedWorkspaceId]);
        const { data } = processStateDumps(allDumps);
        setErrorRates(data);
      } catch (error) {
        console.error("Error fetching state dumps:", error);
        setErrorRates({});
      } finally {
        setIsLoading(false);
      }
    };

    fetchStateDumps();
  }, [isDatabaseLoaded, executeQuery, selectedWorkspaceId]);

  const processStateDumps = (allDumps: DatabaseRow[]) => {
    const parentGroups: Record<string, DatabaseRow[]> = {};
    for (const dump of allDumps) {
      let context;
      try {
        context = JSON.parse(dump.context);
      } catch (e) {
        console.error("Error parsing context for dump", dump.id, e);
        continue;
      }
      const parent = context.parent_function_name;
      if (parent && typeof parent === "string" && parent.trim() !== "") {
        if (!parentGroups[parent]) {
          parentGroups[parent] = [];
        }
        parentGroups[parent].push(dump);
      }
    }

    const processedResults: Record<string, Record<string, ErrorRateData>> = {};

    for (const parent in parentGroups) {
      const parentDumps = parentGroups[parent];

      const functionIdGroups: Record<string, DatabaseRow[]> = {};
      for (const dump of parentDumps) {
        let context;
        try {
          context = JSON.parse(dump.context);
        } catch (e) {
          console.error("Error parsing context for dump", dump.id, e);
          continue;
        }
        if (context.function_id != null) {
          const functionId = context.function_id;
          if (!functionIdGroups[functionId]) {
            functionIdGroups[functionId] = [];
          }
          functionIdGroups[functionId].push(dump);
        }
      }

      processedResults[parent] = {};

      for (const functionId in functionIdGroups) {
        const dumps = functionIdGroups[functionId];
        const postData: Record<string, Record<string, number>> = {};

        const globalDuplicateDumps = dumps.filter((dump) => {
          try {
            const context = JSON.parse(dump.context);
            const func = context.function;
            const postId = context.post_id;
            return (
              func === "llm_response_after_filtering_duplicates" &&
              !postId &&
              context.funtion_id === functionId
            );
          } catch (e) {
            return false;
          }
        });

        const globalDuplicateCounts: Record<string, number> = {};
        for (const dump of globalDuplicateDumps) {
          try {
            const state = JSON.parse(dump.state);

            console.log("Global duplicate", state);
            if (state.difference !== 0 && state.duplicate_filtered_codes) {
              for (const c of state.duplicate_filtered_codes) {
                const postId = c.post_id;
                if (postId) {
                  globalDuplicateCounts[postId] =
                    (globalDuplicateCounts[postId] || 0) + 1;
                }
              }
            }
          } catch (e) {
            console.error("Error processing global duplicate dump", dump.id, e);
          }
        }

        console.log("Final global duplicates", globalDuplicateCounts);

        for (const dump of dumps) {
          let context;
          try {
            context = JSON.parse(dump.context);
          } catch (e) {
            console.error("Error parsing context for dump", dump.id, e);
            continue;
          }
          const postId = context.post_id;
          if (!postId || postId.startsWith("function")) continue;

          if (!postData[postId]) {
            postData[postId] = {};
          }

          let state;
          try {
            state = JSON.parse(dump.state);
          } catch (e) {
            console.error("Error parsing state for dump", dump.id, e);
            continue;
          }
          const func = context.function;

          if (func === "llm_response_before_processing") {
            const codeBlockMatch = state.response.match(
              /```json\n([\s\S]*?)\n```/
            );
            if (codeBlockMatch) {
              const content = codeBlockMatch[1].trim();
              if (content.startsWith("{") && content.endsWith("}")) {
                try {
                  const responseJson = JSON.parse(content);
                  const initialCount =
                    responseJson.concepts?.length ||
                    responseJson.codes?.length ||
                    0;
                  postData[postId]["initial"] = initialCount;
                } catch (e) {
                  console.error("Error parsing JSON for post", postId, e);
                  postData[postId]["initial"] = 0;
                }
              } else {
                postData[postId]["initial"] = 0;
              }
            } else {
              postData[postId]["initial"] = 0;
            }
          } else if (func === "llm_response_after_filtering_hallucinations") {
            const count = state.difference ?? 0;
            postData[postId]["afterHallucinations"] =
              (postData[postId]["afterHallucinations"] ?? 0) + count;
          } else if (func === "llm_response_after_filtering_empty_columns") {
            const count = state?.difference ?? 0;
            postData[postId]["afterEmptyColumns"] =
              (postData[postId]["afterEmptyColumns"] ?? 0) + count;
          } else if (func === "llm_response_after_filtering_duplicates") {
            const count =
              state.difference !== 0
                ? state.duplicate_filtered_codes?.filter(
                    (c: any) => c.postId === postId
                  ).length ?? 0
                : 0;
            postData[postId]["afterDuplicates"] =
              (postData[postId]["afterDuplicates"] ?? 0) + count;
          }
        }

        for (const postId in postData) {
          postData[postId]["afterDuplicates"] =
            (postData[postId]["afterDuplicates"] || 0) +
            (globalDuplicateCounts[postId] || 0);
        }

        const individual: RateData[] = [];
        let totalInput = 0;
        let totalOutput = 0;
        let codedPostCount = 0;
        let weightedErrorSum = 0;
        let totalWeight = 0;

        for (const postId in postData) {
          const counts = postData[postId];
          const initialCount = counts["initial"] || 0;
          const removedByHallucinations = counts["afterHallucinations"] || 0;
          const removedByEmptyColumns = counts["afterEmptyColumns"] || 0;
          const removedByDuplicates = counts["afterDuplicates"] || 0;
          const finalCount =
            initialCount -
            removedByHallucinations -
            removedByEmptyColumns -
            removedByDuplicates;

          const errorRate =
            initialCount > 0
              ? Math.min(
                  1,
                  Math.max(0, (initialCount - finalCount) / initialCount)
                )
              : 0;

          individual.push({
            postId,
            initialCount,
            removedByHallucinations,
            removedByEmptyColumns,
            removedByDuplicates,
            finalCount: Math.max(0, finalCount),
            errorRate,
          });

          totalInput += initialCount;
          totalOutput += Math.max(0, finalCount);
          if (Math.max(0, finalCount) > 0) {
            codedPostCount++;
          }

          const postWeightedError = errorRate * initialCount;
          weightedErrorSum += postWeightedError;
          totalWeight += initialCount;
        }

        const totalErrorRate =
          totalWeight > 0 ? weightedErrorSum / totalWeight : 0;

        processedResults[parent][functionId] = {
          individual,
          total: {
            input: totalInput,
            output: totalOutput,
            error_rate: totalErrorRate,
            codedPostCount,
          },
          group_rates: {},
        };
      }
    }

    return { data: processedResults };
  };

  if (isLoading) {
    return <p className="p-4 text-gray-600">Loading error rates...</p>;
  }

  if (!isDatabaseLoaded) {
    return <p className="p-4 text-gray-600">Please select a database first.</p>;
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">Error Rates</h1>
      {Object.keys(errorRates).length === 0 && (
        <p className="text-gray-600">No error rate data available.</p>
      )}
      {Object.entries(errorRates).map(([parent, functionIdData]) => {
        if (!parent || parent === "undefined" || parent.trim() === "")
          return null;
        return (
          <div key={parent} className="mb-8">
            <h2 className="text-xl font-semibold mb-2 text-gray-700">
              {parent}
            </h2>
            {Object.entries(functionIdData).map(([functionId, rates]) => {
              if (rates.total.input === 0) {
                return null;
              }
              return (
                <div key={functionId} className="mb-6 ml-4">
                  <h3 className="text-lg font-medium mb-2 text-gray-600">
                    Sequence: {functionId}
                  </h3>
                  <h4 className="text-md font-medium mb-2 text-gray-600">
                    Individual Post Error Rates
                  </h4>
                  <table className="table-auto w-full border-collapse border border-gray-300 mb-4">
                    <thead>
                      <tr>
                        <th className="p-2 border bg-gray-100 text-gray-700">
                          Post ID
                        </th>
                        <th className="p-2 border bg-gray-100 text-gray-700">
                          Initial Count
                        </th>
                        <th className="p-2 border bg-gray-100 text-gray-700">
                          Removed by Hallucinations
                        </th>
                        <th className="p-2 border bg-gray-100 text-gray-700">
                          Removed by Empty Columns
                        </th>
                        <th className="p-2 border bg-gray-100 text-gray-700">
                          Removed by Duplicates
                        </th>
                        <th className="p-2 border bg-gray-100 text-gray-700">
                          Final Count
                        </th>
                        <th className="p-2 border bg-gray-100 text-gray-700">
                          Error Rate
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rates.individual.map((data) => (
                        <tr key={data.postId}>
                          <td className="p-2 border text-gray-600">
                            {data.postId}
                          </td>
                          <td className="p-2 border text-gray-600">
                            {data.initialCount}
                          </td>
                          <td className="p-2 border text-gray-600">
                            {data.removedByHallucinations}
                          </td>
                          <td className="p-2 border text-gray-600">
                            {data.removedByEmptyColumns}
                          </td>
                          <td className="p-2 border text-gray-600">
                            {data.removedByDuplicates}
                          </td>
                          <td className="p-2 border text-gray-600">
                            {data.finalCount}
                          </td>
                          <td className="p-2 border text-gray-600">
                            {data.errorRate * 100}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mb-2 text-gray-700">
                    <strong>Total Input Count:</strong> {rates.total.input}
                  </p>
                  <p className="mb-2 text-gray-700">
                    <strong>Total Output Count:</strong> {rates.total.output}
                  </p>
                  <p className="mb-2 text-gray-700">
                    <strong>Total Coded Post Count:</strong>{" "}
                    {rates.total.codedPostCount}
                  </p>
                  <p className="mb-4 text-gray-700">
                    <strong>Weighted Total Error Rate:</strong>{" "}
                    {rates.total.error_rate * 100}%
                  </p>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export default ErrorRates;

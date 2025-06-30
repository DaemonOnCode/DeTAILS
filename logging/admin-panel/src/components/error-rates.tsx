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

interface GlobalSummary {
  totalInitial: number;
  totalFinal: number;
  globalErrorRate: number;
}

interface Processed {
  data: Record<string, Record<string, ErrorRateData>>;
  global: GlobalSummary;
}

function ErrorRates() {
  const { isDatabaseLoaded, executeQuery, selectedWorkspaceId } = useDatabase();
  const [errorRates, setErrorRates] = useState<
    Record<string, Record<string, ErrorRateData>>
  >({});
  const [globalSummary, setGlobalSummary] = useState<GlobalSummary | null>(
    null
  );
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
        const allDumps = (await executeQuery(query, [
          selectedWorkspaceId,
        ])) as DatabaseRow[];

        const { data, global } = processStateDumps(allDumps);
        console.log("Processed error rate data:", data);
        console.log("Global summary:", global);

        setErrorRates(data);
        setGlobalSummary(global);
      } catch (error) {
        console.error("Error fetching state dumps:", error);
        setErrorRates({});
        setGlobalSummary(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStateDumps();
  }, [isDatabaseLoaded, executeQuery, selectedWorkspaceId]);

  const processStateDumps = (allDumps: DatabaseRow[]): Processed => {
    console.log("Raw dumps:", allDumps);

    const parentGroups: Record<string, DatabaseRow[]> = {};
    for (const dump of allDumps) {
      let context;
      try {
        context = JSON.parse(dump.context);
      } catch {
        continue;
      }
      const parent = context.parent_function_name;
      if (parent && typeof parent === "string" && parent.trim() !== "") {
        parentGroups[parent] = parentGroups[parent] || [];
        parentGroups[parent].push(dump);
      }
    }
    console.log("Parent groups:", parentGroups);

    const processedResults: Record<string, Record<string, ErrorRateData>> = {};

    for (const parent in parentGroups) {
      const parentDumps = parentGroups[parent];
      const functionIdGroups: Record<string, DatabaseRow[]> = {};

      for (const dump of parentDumps) {
        let context;
        try {
          context = JSON.parse(dump.context);
        } catch {
          continue;
        }
        if (context.function_id != null) {
          const fid = context.function_id;
          functionIdGroups[fid] = functionIdGroups[fid] || [];
          functionIdGroups[fid].push(dump);
        }
      }
      console.log(
        `FunctionId groups for parent "${parent}":`,
        functionIdGroups
      );

      processedResults[parent] = {};

      for (const functionId in functionIdGroups) {
        const dumps = functionIdGroups[functionId];
        const postData: Record<string, Record<string, number>> = {};

        const globalDupes = dumps.filter((dump) => {
          try {
            const ctx = JSON.parse(dump.context);
            return (
              ctx.function === "llm_response_after_filtering_duplicates" &&
              !ctx.post_id &&
              ctx.function_id === functionId
            );
          } catch {
            return false;
          }
        });
        const globalDuplicateCounts: Record<string, number> = {};
        for (const dump of globalDupes) {
          try {
            const state = JSON.parse(dump.state);
            if (state.difference !== 0 && state.duplicate_filtered_codes) {
              for (const c of state.duplicate_filtered_codes) {
                if (c.post_id) {
                  globalDuplicateCounts[c.post_id] =
                    (globalDuplicateCounts[c.post_id] || 0) + 1;
                }
              }
            }
          } catch {}
        }

        console.log("Final global duplicates", globalDuplicateCounts);

        console.log(
          `Global duplicate counts for function "${functionId}":`,
          globalDuplicateCounts
        );

        for (const dump of dumps) {
          let ctx;
          try {
            ctx = JSON.parse(dump.context);
          } catch {
            continue;
          }
          const postId = ctx.post_id;
          if (!postId || postId.startsWith("function")) continue;
          postData[postId] = postData[postId] || {};

          let state;
          try {
            state = JSON.parse(dump.state);
          } catch {
            continue;
          }
          const func = ctx.function;

          if (func === "llm_response_before_processing") {
            const match = state.response?.match(/```json\n([\s\S]*?)\n```/);
            let initialCount = 0;
            if (match) {
              try {
                const json = JSON.parse(match[1]);
                initialCount = json.concepts?.length || json.codes?.length || 0;
              } catch {}
            }
            postData[postId]["initial"] = initialCount;
          } else if (func === "llm_response_after_filtering_hallucinations") {
            postData[postId]["afterHallucinations"] =
              (postData[postId]["afterHallucinations"] || 0) +
              (state.difference ?? 0);
          } else if (func === "llm_response_after_filtering_empty_columns") {
            postData[postId]["afterEmptyColumns"] =
              (postData[postId]["afterEmptyColumns"] || 0) +
              (state.difference ?? 0);
          } else if (func === "llm_response_after_filtering_duplicates") {
            const dupCount =
              state.difference !== 0
                ? state.duplicate_filtered_codes?.filter(
                    (c: any) => c.post_id === postId
                  ).length ?? 0
                : 0;
            postData[postId]["afterDuplicates"] =
              (postData[postId]["afterDuplicates"] || 0) + dupCount;
          }
        }
        console.log(`Post data for function "${functionId}":`, postData);

        for (const pid in postData) {
          postData[pid]["afterDuplicates"] =
            (postData[pid]["afterDuplicates"] || 0) +
            (globalDuplicateCounts[pid] || 0);
        }

        const individual: RateData[] = [];
        let totalInput = 0;
        let totalOutput = 0;
        let codedPostCount = 0;
        let weightedErrorSum = 0;
        let totalWeight = 0;

        for (const pid in postData) {
          const cnts = postData[pid];
          const initialCount = cnts["initial"] || 0;
          const removedByHallucinations = cnts["afterHallucinations"] || 0;
          const removedByEmptyColumns = cnts["afterEmptyColumns"] || 0;
          const removedByDuplicates = cnts["afterDuplicates"] || 0;
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
            postId: pid,
            initialCount,
            removedByHallucinations,
            removedByEmptyColumns,
            removedByDuplicates,
            finalCount: Math.max(0, finalCount),
            errorRate,
          });

          totalInput += initialCount;
          totalOutput += Math.max(0, finalCount);
          if (finalCount > 0) codedPostCount++;

          weightedErrorSum += errorRate * initialCount;
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
        console.log(
          `Result for ${parent} / ${functionId}:`,
          processedResults[parent][functionId]
        );
      }
    }

    console.log("Processed results (per parent/function):", processedResults);

    let grandTotalInput = 0;
    let grandTotalOutput = 0;
    for (const parent in processedResults) {
      for (const funcId in processedResults[parent]) {
        const { input, output } = processedResults[parent][funcId].total;
        grandTotalInput += input;
        grandTotalOutput += output;
      }
    }
    const globalErrorRate =
      grandTotalInput > 0
        ? (grandTotalInput - grandTotalOutput) / grandTotalInput
        : 0;

    console.log("Global totals:", {
      grandTotalInput,
      grandTotalOutput,
      globalErrorRate,
    });

    return {
      data: processedResults,
      global: {
        totalInitial: grandTotalInput,
        totalFinal: grandTotalOutput,
        globalErrorRate,
      },
    };
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

      {globalSummary && (
        <div className="mb-6 p-4 bg-gray-100 rounded">
          <p>
            <strong>Global Initial Count:</strong> {globalSummary.totalInitial}
          </p>
          <p>
            <strong>Global Final Count:</strong> {globalSummary.totalFinal}
          </p>
          <p>
            <strong>Global Error Rate:</strong>{" "}
            {globalSummary.globalErrorRate * 100}%
          </p>
        </div>
      )}

      {Object.keys(errorRates).length === 0 && (
        <p className="text-gray-600">No error rate data available.</p>
      )}

      {Object.entries(errorRates).map(([parent, functionIdData]) => {
        if (!parent || parent.trim() === "") return null;
        return (
          <div key={parent} className="mb-8">
            <h2 className="text-xl font-semibold mb-2 text-gray-700">
              {parent}
            </h2>
            {Object.entries(functionIdData).map(([functionId, rates]) => {
              if (rates.total.input === 0) return null;
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
                            {(data.errorRate * 100).toFixed(1)}%
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

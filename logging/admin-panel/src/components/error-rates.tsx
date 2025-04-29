import { useState, useEffect } from "react";
import { useDatabase } from "./context";
import { DatabaseRow } from "../utils/types";

interface RateData {
  postId: string;
  initialCount: number;
  removedByHallucinations: number;
  removedByDuplicates: number;
  removedByEmptyColumns: number;
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
  const [errorRates, setErrorRates] = useState<Record<string, ErrorRateData>>(
    {}
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStateDumps = async () => {
      if (!isDatabaseLoaded) return;

      setIsLoading(true);
      try {
        const query = `
          SELECT * FROM state_dumps
          WHERE (json_extract(context, '$.parent_function_name') IN ('generate-initial-codes', 'final-coding', 'generate-deductive-codes', 'remake-codebook', 'redo-final-coding')
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

    const processedResults: Record<string, ErrorRateData> = {};

    const requiredFunctions: Record<string, string> = {
      "generate-initial-codes": "initial_codes",
      "final-coding": "final_codes",
      "generate-deductive-codes": "generate_deductive_codes",
      "remake-codebook": "initial_codes",
      "redo-final-coding": "final_codes",
    };

    for (const parent in parentGroups) {
      const requiredFunc = requiredFunctions[parent];
      let hasRequiredFunc = false;

      if (requiredFunc) {
        hasRequiredFunc = parentGroups[parent].some((dump) => {
          try {
            const context = JSON.parse(dump.context);
            return context.function === requiredFunc;
          } catch (e) {
            console.error("Error parsing context for dump", dump.id, e);
            return false;
          }
        });
      }
      const dumps = parentGroups[parent];
      const postData: Record<string, Record<string, number>> = {};
      let currentPostId: string | null = null;

      for (const dump of dumps) {
        let context;
        try {
          context = JSON.parse(dump.context);
        } catch (e) {
          console.error("Error parsing context for dump", dump.id, e);
          continue;
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
          currentPostId = context.post_id;
          if (!currentPostId || currentPostId.startsWith("function")) continue;
          if (!postData[currentPostId]) {
            postData[currentPostId] = {};
          }
          const codeBlockMatch = state.response.match(
            /```json\n([\s\S]*?)\n```/
          );
          if (codeBlockMatch) {
            const content = codeBlockMatch[1].trim();
            if (content.startsWith("{") && content.endsWith("}")) {
              try {
                const responseJson = JSON.parse(content);
                const initialCount = responseJson.codes.length;
                postData[currentPostId]["initial"] = initialCount;
              } catch (e) {
                console.error("Error parsing JSON for post", currentPostId, e);
                postData[currentPostId]["initial"] = 0;
              }
            } else {
              postData[currentPostId]["initial"] = 0;
            }
          } else {
            postData[currentPostId]["initial"] = 0;
          }
        } else if (currentPostId) {
          let count: number;
          if (func === "llm_response_after_filtering_hallucinations") {
            count =
              state.filtered_code_count ||
              state.hallucination_filtered_codes?.length ||
              0;
            postData[currentPostId]["afterHallucinations"] = count;
          } else if (func === "llm_response_after_filtering_duplicates") {
            count =
              state.filtered_code_count ||
              state.duplicate_filtered_codes?.length ||
              0;
            postData[currentPostId]["afterDuplicates"] = count;
          } else if (func === "llm_response_after_filtering_empty_columns") {
            count = state.response_count || state.final_responses?.length || 0;
            postData[currentPostId]["final"] = count;
          }
        }
      }

      processedResults[parent] = {
        individual: [],
        total: { input: 0, output: 0, error_rate: 0, codedPostCount: 0 },
        group_rates: {},
      };

      let weightedErrorSum = 0;
      let totalWeight = 0;
      const codedPostIds: string[] = [];

      for (const postId in postData) {
        const counts = postData[postId];
        const initialCount = counts["initial"] || 0;
        const afterHallucinations =
          counts["afterHallucinations"] !== undefined
            ? counts["afterHallucinations"]
            : initialCount;
        const afterDuplicates =
          counts["afterDuplicates"] !== undefined
            ? counts["afterDuplicates"]
            : afterHallucinations;
        const finalCount =
          counts["final"] !== undefined ? counts["final"] : afterDuplicates;

        const removedByHallucinations = initialCount - afterHallucinations;
        const removedByDuplicates = afterHallucinations - afterDuplicates;
        const removedByEmptyColumns = afterDuplicates - finalCount;

        const errorRate =
          initialCount > 0 ? (initialCount - finalCount) / initialCount : 0;
        console.log(
          `Post ${postId} error rate: ${(errorRate * 100).toFixed(
            2
          )}% (initial: ${initialCount}, final: ${finalCount})`
        );

        processedResults[parent].individual.push({
          postId,
          initialCount,
          removedByHallucinations,
          removedByDuplicates,
          removedByEmptyColumns,
          finalCount,
          errorRate,
        });

        processedResults[parent].total.input += initialCount;
        processedResults[parent].total.output += finalCount;

        if (finalCount > 0) {
          processedResults[parent].total.codedPostCount++;
          codedPostIds.push(postId);
        }

        const postWeightedError = errorRate * initialCount;
        weightedErrorSum += postWeightedError;
        totalWeight += initialCount;
        console.log(
          `Post ${postId} contribution to weighted sum: ${postWeightedError} (errorRate * initialCount)`
        );
        console.log(
          `Current weightedErrorSum: ${weightedErrorSum}, totalWeight: ${totalWeight}`
        );
      }

      processedResults[parent].total.error_rate =
        totalWeight > 0 ? weightedErrorSum / totalWeight : 0;
      console.log(
        `Total weighted error rate for parent ${parent}: ${(
          processedResults[parent].total.error_rate * 100
        ).toFixed(2)}%`
      );
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
      {Object.entries(errorRates).map(([key, rates]) => {
        if (!key || key === "undefined" || key.trim() === "") return null;
        return (
          <div key={key} className="mb-8">
            <h2 className="text-xl font-semibold mb-2 text-gray-700">{key}</h2>
            <h3 className="text-lg font-medium mb-2 text-gray-700">
              Individual Post Error Rates
            </h3>
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
                    Removed by Duplicates
                  </th>
                  <th className="p-2 border bg-gray-100 text-gray-700">
                    Removed by Empty Columns
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
                    <td className="p-2 border text-gray-600">{data.postId}</td>
                    <td className="p-2 border text-gray-600">
                      {data.initialCount}
                    </td>
                    <td className="p-2 border text-gray-600">
                      {data.removedByHallucinations}
                    </td>
                    <td className="p-2 border text-gray-600">
                      {data.removedByDuplicates}
                    </td>
                    <td className="p-2 border text-gray-600">
                      {data.removedByEmptyColumns}
                    </td>
                    <td className="p-2 border text-gray-600">
                      {data.finalCount}
                    </td>
                    <td className="p-2 border text-gray-600">
                      {(data.errorRate * 100).toFixed(2)}%
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
              {(rates.total.error_rate * 100).toFixed(2)}%
            </p>
          </div>
        );
      })}
    </div>
  );
}

export default ErrorRates;

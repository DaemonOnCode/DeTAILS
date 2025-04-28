import { useState, useEffect } from "react";
import { useDatabase } from "./context";
import { DatabaseRow } from "../utils/types";

interface RateData {
  input: number;
  output: number;
  error_rate: number;
}

interface ErrorRateData {
  individual: Record<string, RateData>;
  total: RateData;
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
        const sampleQuery = `
          SELECT * FROM state_dumps
          WHERE json_extract(context, '$.function') = 'sample_posts'
          AND json_extract(context, '$.workspace_id') = ?
          ORDER BY id DESC
          LIMIT 1
        `;
        const sampleResult = await executeQuery(sampleQuery, [
          selectedWorkspaceId,
        ]);
        const sampleDump = sampleResult[0];
        const groups = JSON.parse(sampleDump.state).groups;

        const hallucinationQuery = `
          SELECT * FROM state_dumps
          WHERE json_extract(context, '$.function') = 'llm_response_after_filtering_hallucinations'
          AND json_extract(context, '$.workspace_id') = ?
          ORDER BY id
        `;
        const hallucinationDumps = await executeQuery(hallucinationQuery, [
          selectedWorkspaceId,
        ]);

        const emptyColumnsQuery = `
          SELECT * FROM state_dumps
          WHERE json_extract(context, '$.function') = 'llm_response_after_filtering_empty_columns'
          AND json_extract(context, '$.workspace_id') = ?
          ORDER BY id
        `;
        const emptyColumnsDumps = await executeQuery(emptyColumnsQuery, [
          selectedWorkspaceId,
        ]);

        const data = processStateDumps(
          hallucinationDumps,
          emptyColumnsDumps,
          groups
        );
        setErrorRates(data);
      } catch (error) {
        console.error("Error fetching state dumps:", error);
        setErrorRates({});
      } finally {
        setIsLoading(false);
      }
    };

    fetchStateDumps();
  }, [isDatabaseLoaded, executeQuery]);

  const processStateDumps = (
    hallucinationDumps: DatabaseRow[],
    emptyColumnsDumps: DatabaseRow[],
    groups: Record<string, string[]>
  ) => {
    console.log(
      "Processing state dumps...",
      hallucinationDumps,
      emptyColumnsDumps,
      groups
    );
    const hallucinationMap: Record<string, Record<string, number>> = {};
    hallucinationDumps.forEach((dump) => {
      const context = JSON.parse(dump.context);
      const state = JSON.parse(dump.state);
      const parent = context.parent_function_name;
      const postId = state.initial_codes[0]?.postId || "unknown";
      const initialCount = state.code_count || state.initial_codes.length;
      if (!hallucinationMap[parent]) hallucinationMap[parent] = {};
      hallucinationMap[parent][postId] = initialCount;
    });

    const emptyColumnsMap: Record<string, Record<string, number>> = {};
    emptyColumnsDumps.forEach((dump) => {
      const context = JSON.parse(dump.context);
      const state = JSON.parse(dump.state);
      const parent = context.parent_function_name;
      const postId = state.initial_responses[0]?.postId || "unknown";
      const finalCount = state.response_count || state.final_responses.length;
      if (!emptyColumnsMap[parent]) emptyColumnsMap[parent] = {};
      emptyColumnsMap[parent][postId] = finalCount;
    });

    const results: Record<string, ErrorRateData> = {};
    for (const parent in hallucinationMap) {
      results[parent] = {
        individual: {},
        total: { input: 0, output: 0, error_rate: 0 },
        group_rates: {},
      };
      let totalInitial = 0;
      let totalFinal = 0;

      for (const postId in hallucinationMap[parent]) {
        const initial = hallucinationMap[parent][postId];
        const final = emptyColumnsMap[parent]?.[postId] || 0;
        const errorRate = initial > 0 ? (initial - final) / initial : 0;
        results[parent].individual[postId] = {
          input: initial,
          output: final,
          error_rate: errorRate,
        };
        totalInitial += initial;
        totalFinal += final;
      }

      results[parent].total = {
        input: totalInitial,
        output: totalFinal,
        error_rate:
          totalInitial > 0 ? (totalInitial - totalFinal) / totalInitial : 0,
      };

      for (const groupName in groups) {
        let groupInitial = 0;
        let groupFinal = 0;
        groups[groupName].forEach((postId) => {
          if (hallucinationMap[parent][postId]) {
            groupInitial += hallucinationMap[parent][postId];
            groupFinal += emptyColumnsMap[parent]?.[postId] || 0;
          }
        });
        results[parent].group_rates[groupName] = {
          input: groupInitial,
          output: groupFinal,
          error_rate:
            groupInitial > 0 ? (groupInitial - groupFinal) / groupInitial : 0,
        };
      }
    }

    return results;
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
      {Object.entries(errorRates).map(([parent, rates]) => (
        <div key={parent} className="mb-8">
          <h2 className="text-xl font-semibold mb-2 text-gray-700">{parent}</h2>

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
                  Input Count
                </th>
                <th className="p-2 border bg-gray-100 text-gray-700">
                  Output Count
                </th>
                <th className="p-2 border bg-gray-100 text-gray-700">
                  Error Rate
                </th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(rates.individual).map(([postId, data]) => (
                <tr key={postId}>
                  <td className="p-2 border text-gray-600">{postId}</td>
                  <td className="p-2 border text-gray-600">{data.input}</td>
                  <td className="p-2 border text-gray-600">{data.output}</td>
                  <td className="p-2 border text-gray-600">
                    {(data.error_rate * 100).toFixed(2)}%
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
          <p className="mb-4 text-gray-700">
            <strong>Total Error Rate:</strong>{" "}
            {(rates.total.error_rate * 100).toFixed(2)}%
          </p>
        </div>
      ))}
    </div>
  );
}

export default ErrorRates;

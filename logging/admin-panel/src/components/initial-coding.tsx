import React, { useState, useEffect, useRef } from "react";
import { useDatabase } from "./context";

// Type Definitions
interface DatabaseRow {
  id: number;
  created_at: string;
  state: string;
  context: string;
}

interface Context {
  function: string;
  run?: string;
  [key: string]: any;
}

interface CodingResult {
  id: string;
  model: string;
  quote: string;
  code: string;
  explanation: string;
  post_id: string;
  chat_history: any | null;
  is_marked: boolean | null;
  range_marker: any | null;
}

interface FieldChange {
  type:
    | "model_changed"
    | "quote_changed"
    | "code_changed"
    | "explanation_changed"
    | "chat_history_changed"
    | "is_marked_changed"
    | "range_marker_changed";
  resultId: string;
  oldValue: any;
  newValue: any;
  similarity?: number; // Added for code and quote changes
}

interface CRUDChanges {
  inserted: CodingResult[];
  updated: FieldChange[];
  deleted: CodingResult[];
}

interface SequenceDiff {
  sequenceId: number;
  initialTimestamp: string;
  finalTimestamp: string;
  isRegeneration: boolean;
  changes: CRUDChanges;
  stepwiseChanges: { step: number; changes: CRUDChanges }[];
  accuracy: number;
  precision: number;
  recall: number;
}

// Helper Functions
const safeParseContext = (context: string): Context => {
  try {
    return JSON.parse(context);
  } catch {
    return { function: "Unknown" };
  }
};

const groupEntriesIntoSequences = (entries: DatabaseRow[]): DatabaseRow[][] => {
  const sequences: DatabaseRow[][] = [];
  let currentSequence: DatabaseRow[] = [];
  for (const entry of entries) {
    const context = safeParseContext(entry.context);
    if (context.function === "initial_codes") {
      if (currentSequence.length > 0) sequences.push(currentSequence);
      currentSequence = [entry];
    } else if (
      context.function === "dispatchSampledPostResponse" &&
      currentSequence.length > 0
    ) {
      currentSequence.push(entry);
    }
  }
  if (currentSequence.length > 0) sequences.push(currentSequence);
  return sequences;
};

const extractResults = (
  state: any,
  stateType: "generation" | "dispatch"
): Map<string, CodingResult> => {
  const results = new Map<string, CodingResult>();
  const resultsArray =
    stateType === "generation" ? state.results : state.current_state;
  resultsArray.forEach((result: any) => {
    results.set(result.id, {
      id: result.id,
      model: result.model,
      quote: result.quote,
      code: result.code,
      explanation: result.explanation,
      post_id: result.post_id,
      chat_history: result.chat_history
        ? JSON.parse(result.chat_history)
        : null,
      is_marked: result.is_marked !== null ? Boolean(result.is_marked) : null,
      range_marker: result.range_marker
        ? JSON.parse(result.range_marker)
        : null,
    });
  });
  return results;
};

const computeChanges = async (
  prevResults: Map<string, CodingResult>,
  currResults: Map<string, CodingResult>,
  getSimilarity: (textA: string, textB: string) => Promise<number>
): Promise<CRUDChanges> => {
  const prevIds = new Set(prevResults.keys());
  const currIds = new Set(currResults.keys());

  const inserted = [...currIds]
    .filter((id) => !prevIds.has(id))
    .map((id) => currResults.get(id)!);
  const deleted = [...prevIds]
    .filter((id) => !currIds.has(id))
    .map((id) => prevResults.get(id)!);
  const updated: FieldChange[] = [];

  const commonIds = [...prevIds].filter((id) => currIds.has(id));

  for (const id of commonIds) {
    const prev = prevResults.get(id);
    const curr = currResults.get(id);
    if (prev && curr) {
      if (prev.quote !== curr.quote) {
        const similarity = await getSimilarity(prev.quote, curr.quote);
        updated.push({
          type: "quote_changed",
          resultId: id,
          oldValue: prev.quote,
          newValue: curr.quote,
          similarity,
        });
      }
      if (prev.code !== curr.code) {
        const similarity = await getSimilarity(prev.code, curr.code);
        updated.push({
          type: "code_changed",
          resultId: id,
          oldValue: prev.code,
          newValue: curr.code,
          similarity,
        });
      }
      if (prev.explanation !== curr.explanation) {
        updated.push({
          type: "explanation_changed",
          resultId: id,
          oldValue: prev.explanation,
          newValue: curr.explanation,
        });
      }
      if (
        JSON.stringify(prev.chat_history) !== JSON.stringify(curr.chat_history)
      ) {
        updated.push({
          type: "chat_history_changed",
          resultId: id,
          oldValue: prev.chat_history,
          newValue: curr.chat_history,
        });
      }
      if (prev.is_marked !== curr.is_marked) {
        updated.push({
          type: "is_marked_changed",
          resultId: id,
          oldValue: prev.is_marked,
          newValue: curr.is_marked,
        });
      }
      if (
        JSON.stringify(prev.range_marker) !== JSON.stringify(curr.range_marker)
      ) {
        updated.push({
          type: "range_marker_changed",
          resultId: id,
          oldValue: prev.range_marker,
          newValue: curr.range_marker,
        });
      }
    }
  }

  return { inserted, updated, deleted };
};

const areCodingResultsEqual = (a: CodingResult, b: CodingResult): boolean => {
  return (
    a.model === b.model &&
    a.quote === b.quote &&
    a.code === b.code &&
    a.explanation === b.explanation &&
    a.post_id === b.post_id &&
    JSON.stringify(a.chat_history) === JSON.stringify(b.chat_history) &&
    a.is_marked === b.is_marked &&
    JSON.stringify(a.range_marker) === JSON.stringify(b.range_marker)
  );
};

const renderChangeDetails = (change: FieldChange): string => {
  let base = `Result ID: ${change.resultId}, `;
  switch (change.type) {
    case "quote_changed":
      base += `Old Quote: ${change.oldValue}, New Quote: ${change.newValue}`;
      if (change.similarity !== undefined) {
        base += `, \n\nSimilarity: ${change.similarity.toFixed(3)}`;
      }
      return base;
    case "code_changed":
      base += `Old Code: ${change.oldValue}, New Code: ${change.newValue}`;
      if (change.similarity !== undefined) {
        base += `, \n\nSimilarity: ${change.similarity.toFixed(3)}`;
      }
      return base;
    case "explanation_changed":
      return `Result ID: ${change.resultId}, Old Explanation: ${change.oldValue}, New Explanation: ${change.newValue}`;
    case "chat_history_changed":
      return `Result ID: ${change.resultId}, Chat History Changed`;
    case "is_marked_changed":
      return `Result ID: ${change.resultId}, Old Is Marked: ${change.oldValue}, New Is Marked: ${change.newValue}`;
    case "range_marker_changed":
      return `Result ID: ${change.resultId}, Range Marker Changed`;
    default:
      return "";
  }
};

const CodingResultsDiffViewer: React.FC = () => {
  const {
    isDatabaseLoaded,
    executeQuery,
    calculateSimilarity,
    selectedWorkspaceId,
  } = useDatabase();
  const [sequences, setSequences] = useState<DatabaseRow[][]>([]);
  const [sequenceDiffs, setSequenceDiffs] = useState<SequenceDiff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openSteps, setOpenSteps] = useState<{ [key: number]: boolean }>({});
  const similarityCache = useRef(new Map<string, number>());

  const getSimilarity = async (
    textA: string,
    textB: string
  ): Promise<number> => {
    if (textA === textB) return 1.0;
    const key = [textA, textB].sort().join("-");
    if (similarityCache.current.has(key)) {
      return similarityCache.current.get(key)!;
    }
    const sim = await calculateSimilarity(textA, textB);
    similarityCache.current.set(key, sim);
    return sim;
  };

  const codingResultSimilarity = async (
    resultA: CodingResult,
    resultB: CodingResult
  ): Promise<number> => {
    const quoteSim = await getSimilarity(resultA.quote, resultB.quote);
    const codeSim = await getSimilarity(resultA.code, resultB.code);
    return (quoteSim + codeSim) / 2;
  };

  const computeMetrics = async (
    initialResults: Map<string, CodingResult>,
    finalResults: Map<string, CodingResult>
  ): Promise<{ accuracy: number; precision: number; recall: number }> => {
    const initialIds = new Set(initialResults.keys());
    const finalIds = new Set(finalResults.keys());
    const allIds = new Set([...initialIds, ...finalIds]);
    const commonIds = [...initialIds].filter((id) => finalIds.has(id));

    let TP = 0;
    let FN_contribution = 0;
    const similarityPromises: Promise<void>[] = [];

    commonIds.forEach((id) => {
      const initialResult = initialResults.get(id)!;
      const finalResult = finalResults.get(id)!;
      if (areCodingResultsEqual(initialResult, finalResult)) {
        TP += 1;
      } else {
        const similarityPromise = codingResultSimilarity(
          initialResult,
          finalResult
        ).then((similarity) => {
          TP += similarity;
          FN_contribution += 1 - similarity;
        });
        similarityPromises.push(similarityPromise);
      }
    });

    await Promise.all(similarityPromises);

    const FP = finalIds.size - commonIds.length;
    const FN = initialIds.size - commonIds.length + FN_contribution;

    const accuracy = allIds.size > 0 ? TP / allIds.size : 0;
    const precision = TP + FP > 0 ? TP / (TP + FP) : 0;
    const recall = TP + FN > 0 ? TP / (TP + FN) : 0;

    return { accuracy, precision, recall };
  };

  useEffect(() => {
    const fetchEntries = async () => {
      setIsLoading(true);
      try {
        const query = `
          SELECT * FROM state_dumps
          WHERE json_extract(context, '$.function') IN ('initial_codes', 'dispatchSampledPostResponse')
          AND json_extract(context, '$.workspace_id') = ?
          ORDER BY created_at ASC
        `;
        const result = await executeQuery(query, [selectedWorkspaceId]);
        setSequences(groupEntriesIntoSequences(result));
      } catch (error) {
        console.error("Error fetching entries:", error);
        setSequences([]);
      } finally {
        setIsLoading(false);
      }
    };
    if (isDatabaseLoaded) fetchEntries();
  }, [isDatabaseLoaded, executeQuery]);

  useEffect(() => {
    const computeDiffs = async () => {
      const diffs = await Promise.all(
        sequences.map(async (sequence, seqIndex) => {
          const initialEntry = sequence[0];
          const initialContext = safeParseContext(initialEntry.context);
          const isRegeneration = initialContext.run === "regenerate";
          const initialState = JSON.parse(initialEntry.state);
          const finalState =
            sequence.length > 1
              ? JSON.parse(sequence[sequence.length - 1].state)
              : initialState;

          const initialResults = extractResults(initialState, "generation");
          const finalResults =
            sequence.length > 1
              ? extractResults(finalState, "dispatch")
              : initialResults;

          const changes = await computeChanges(
            initialResults,
            finalResults,
            getSimilarity
          );
          const { accuracy, precision, recall } = await computeMetrics(
            initialResults,
            finalResults
          );

          const stepwiseChanges: { step: number; changes: CRUDChanges }[] = [];
          let prevResults = initialResults;
          for (let i = 1; i < sequence.length; i++) {
            const currState = JSON.parse(sequence[i].state);
            const currResults = extractResults(currState, "dispatch");
            const stepChanges = await computeChanges(
              prevResults,
              currResults,
              getSimilarity
            );
            if (
              stepChanges.inserted.length > 0 ||
              stepChanges.updated.length > 0 ||
              stepChanges.deleted.length > 0
            ) {
              stepwiseChanges.push({ step: i, changes: stepChanges });
            }
            prevResults = currResults;
          }

          return {
            sequenceId: seqIndex + 1,
            initialTimestamp: new Date(
              initialEntry.created_at
            ).toLocaleString(),
            finalTimestamp: new Date(
              sequence[sequence.length - 1].created_at
            ).toLocaleString(),
            isRegeneration,
            changes,
            stepwiseChanges,
            accuracy,
            precision,
            recall,
          };
        })
      );
      setSequenceDiffs(diffs);
    };

    if (sequences.length > 0) {
      computeDiffs();
    }
  }, [sequences]);

  const toggleStep = (step: number) => {
    setOpenSteps((prev) => ({ ...prev, [step]: !prev[step] }));
  };

  const totalRegenerations = sequenceDiffs.filter(
    (seq) => seq.isRegeneration
  ).length;

  if (isLoading)
    return <p className="p-4 text-gray-600">Loading sequences...</p>;
  if (!isDatabaseLoaded)
    return <p className="p-4 text-gray-600">Please select a database first.</p>;

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">
        Coding Results Diff Viewer
      </h1>
      <p className="mb-4 text-gray-600">
        Total number of regenerations: {totalRegenerations}
      </p>
      {sequenceDiffs.length === 0 ? (
        <p className="text-gray-600">No sequences found.</p>
      ) : (
        sequenceDiffs.map((seqDiff) => (
          <div key={seqDiff.sequenceId} className="mb-8">
            <h2 className="text-xl font-semibold mb-2 text-gray-700">
              Sequence {seqDiff.sequenceId}: {seqDiff.initialTimestamp} to{" "}
              {seqDiff.finalTimestamp} (
              {seqDiff.isRegeneration ? "Regeneration" : "Initial Generation"})
            </h2>
            <div className="mb-4 text-gray-600">
              <p>
                <strong>Accuracy:</strong> {seqDiff.accuracy.toFixed(3)}
              </p>
              <p>
                <strong>Precision:</strong> {seqDiff.precision.toFixed(3)}
              </p>
              <p>
                <strong>Recall:</strong> {seqDiff.recall.toFixed(3)}
              </p>
            </div>

            <h3 className="text-lg font-medium mb-2 text-gray-700">
              Initial vs Final Changes
            </h3>
            <div>
              <h4 className="text-md font-medium text-gray-600">
                Inserted Results
              </h4>
              {seqDiff.changes.inserted.length > 0 ? (
                <table className="table-auto w-full border-collapse border border-gray-300 mb-4">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="p-2 border">ID</th>
                      <th className="p-2 border">Model</th>
                      <th className="p-2 border">Quote</th>
                      <th className="p-2 border">Code</th>
                    </tr>
                  </thead>
                  <tbody>
                    {seqDiff.changes.inserted.map((result) => (
                      <tr key={result.id}>
                        <td className="p-2 border">{result.id}</td>
                        <td className="p-2 border">{result.model}</td>
                        <td className="p-2 border">{result.quote}</td>
                        <td className="p-2 border">{result.code}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="mb-2 text-gray-600">No inserted results.</p>
              )}

              <h4 className="text-md font-medium text-gray-600">
                Updated Results
              </h4>
              {seqDiff.changes.updated.length > 0 ? (
                <table className="table-auto w-full border-collapse border border-gray-300 mb-4">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="p-2 border">Type</th>
                      <th className="p-2 border">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {seqDiff.changes.updated.map((change, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="p-2 border">{change.type}</td>
                        <td className="p-2 border">
                          {renderChangeDetails(change)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="mb-2 text-gray-600">No updated results.</p>
              )}

              <h4 className="text-md font-medium text-gray-600">
                Deleted Results
              </h4>
              {seqDiff.changes.deleted.length > 0 ? (
                <table className="table-auto w-full border-collapse border border-gray-300 mb-4">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="p-2 border">ID</th>
                      <th className="p-2 border">Model</th>
                      <th className="p-2 border">Quote</th>
                      <th className="p-2 border">Code</th>
                    </tr>
                  </thead>
                  <tbody>
                    {seqDiff.changes.deleted.map((result) => (
                      <tr key={result.id}>
                        <td className="p-2 border">{result.id}</td>
                        <td className="p-2 border">{result.model}</td>
                        <td className="p-2 border">{result.quote}</td>
                        <td className="p-2 border">{result.code}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="mb-2 text-gray-600">No deleted results.</p>
              )}
            </div>

            <h3 className="text-lg font-medium mb-2 text-gray-700">
              Stepwise Changes
            </h3>
            {seqDiff.stepwiseChanges.length > 0 ? (
              seqDiff.stepwiseChanges.map((step) => (
                <div key={step.step} className="mb-4">
                  <h4
                    className="text-md font-medium text-gray-600 cursor-pointer"
                    onClick={() => toggleStep(step.step)}
                  >
                    Step {step.step} {openSteps[step.step] ? "▲" : "▼"}
                  </h4>
                  {openSteps[step.step] && (
                    <div>
                      <h5 className="text-sm font-medium text-gray-500">
                        Inserted Results
                      </h5>
                      {step.changes.inserted.length > 0 ? (
                        <table className="table-auto w-full border-collapse border border-gray-300 mb-2">
                          <thead>
                            <tr className="bg-gray-100">
                              <th className="p-2 border">ID</th>
                              <th className="p-2 border">Model</th>
                              <th className="p-2 border">Quote</th>
                              <th className="p-2 border">Code</th>
                            </tr>
                          </thead>
                          <tbody>
                            {step.changes.inserted.map((result) => (
                              <tr key={result.id}>
                                <td className="p-2 border">{result.id}</td>
                                <td className="p-2 border">{result.model}</td>
                                <td className="p-2 border">{result.quote}</td>
                                <td className="p-2 border">{result.code}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="mb-2 text-gray-600">
                          No inserted results in this step.
                        </p>
                      )}

                      <h5 className="text-sm font-medium text-gray-500">
                        Updated Results
                      </h5>
                      {step.changes.updated.length > 0 ? (
                        <table className="table-auto w-full border-collapse border border-gray-300 mb-2">
                          <thead>
                            <tr className="bg-gray-100">
                              <th className="p-2 border">Type</th>
                              <th className="p-2 border">Details</th>
                            </tr>
                          </thead>
                          <tbody>
                            {step.changes.updated.map((change, index) => (
                              <tr key={index} className="hover:bg-gray-50">
                                <td className="p-2 border">{change.type}</td>
                                <td className="p-2 border whitespace-pre-line">
                                  {renderChangeDetails(change)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="mb-2 text-gray-600">
                          No updated results in this step.
                        </p>
                      )}

                      <h5 className="text-sm font-medium text-gray-500">
                        Deleted Results
                      </h5>
                      {step.changes.deleted.length > 0 ? (
                        <table className="table-auto w-full border-collapse border border-gray-300 mb-2">
                          <thead>
                            <tr className="bg-gray-100">
                              <th className="p-2 border">ID</th>
                              <th className="p-2 border">Model</th>
                              <th className="p-2 border">Quote</th>
                              <th className="p-2 border">Code</th>
                            </tr>
                          </thead>
                          <tbody>
                            {step.changes.deleted.map((result) => (
                              <tr key={result.id}>
                                <td className="p-2 border">{result.id}</td>
                                <td className="p-2 border">{result.model}</td>
                                <td className="p-2 border">{result.quote}</td>
                                <td className="p-2 border">{result.code}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="mb-2 text-gray-600">
                          No deleted results in this step.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-gray-600">
                No stepwise changes in this sequence.
              </p>
            )}
          </div>
        ))
      )}
    </div>
  );
};

export default CodingResultsDiffViewer;

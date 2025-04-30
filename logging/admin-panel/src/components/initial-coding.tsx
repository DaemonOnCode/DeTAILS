import React, { useState, useEffect, useRef } from "react";
import { useDatabase } from "./context";
import { DatabaseRow, Context, CodingResult } from "../utils/types";

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
  similarity?: number;
  code: string;
  quote: string;
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
  precision: number;
  recall: number;
}

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
      response_type: result.response_type,
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
          code: curr.code,
          quote: curr.quote,
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
          code: curr.code,
          quote: curr.quote,
        });
      }
      if (prev.is_marked !== curr.is_marked) {
        updated.push({
          type: "is_marked_changed",
          resultId: id,
          oldValue: prev.is_marked,
          newValue: curr.is_marked,
          code: curr.code,
          quote: curr.quote,
        });
      }
    }
  }

  return { inserted, updated, deleted };
};

const computeMetrics = async (
  initialResults: Map<string, CodingResult>,
  finalResults: Map<string, CodingResult>,
  getSimilarity: (textA: string, textB: string) => Promise<number>
): Promise<{ precision: number; recall: number }> => {
  const initialIds = new Set(initialResults.keys());
  const finalIds = new Set(finalResults.keys());
  const commonIds = [...initialIds].filter((id) => finalIds.has(id));
  const insertedIds = [...finalIds].filter((id) => !initialIds.has(id));
  const deletedIds = [...initialIds].filter((id) => !finalIds.has(id));

  console.log("Before TP", commonIds, insertedIds, deletedIds);
  let TP = 0;
  let unweightedTP = 0;
  for (const id of commonIds) {
    const final = finalResults.get(id)!;
    if (final.is_marked === true) {
      const initial = initialResults.get(id)!;
      const quoteSim = await getSimilarity(initial.quote, final.quote);
      const codeSim = await getSimilarity(initial.code, final.code);

      console.log(
        "TP similarity check",
        quoteSim,
        codeSim,
        (quoteSim + codeSim) / 2
      );
      TP += (quoteSim + codeSim) / 2;
      unweightedTP++;
    }
  }
  const falseMarkedCount = commonIds.filter((id) => {
    const final = finalResults.get(id)!;
    return final.is_marked === false;
  }).length;
  const FP = deletedIds.length + falseMarkedCount;

  const FN = insertedIds.filter((id) => {
    const final = finalResults.get(id)!;
    return final.is_marked === true;
  }).length;

  const precision = TP + FP > 0 ? TP / (unweightedTP + FP) : 0;
  const recall = TP + FN > 0 ? TP / (unweightedTP + FN) : 0;

  return { precision, recall };
};

const InitialCodingResultsDiffViewer: React.FC = () => {
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
  }, [isDatabaseLoaded, executeQuery, selectedWorkspaceId]);

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
          const { precision, recall } = await computeMetrics(
            initialResults,
            finalResults,
            getSimilarity
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
        Initial Coding Results
      </h1>
      <p className="mb-4 text-gray-600">
        Total number of regenerations: {totalRegenerations}
      </p>
      {sequenceDiffs.length === 0 ? (
        <p className="text-gray-600">No sequences found.</p>
      ) : (
        sequenceDiffs.map((seqDiff) => {
          const groupedUpdates = seqDiff.changes.updated.reduce(
            (acc, change) => {
              if (!acc[change.type]) {
                acc[change.type] = [];
              }
              acc[change.type].push(change);
              return acc;
            },
            {} as { [key: string]: FieldChange[] }
          );

          return (
            <div key={seqDiff.sequenceId} className="mb-8">
              <h2 className="text-xl font-semibold mb-2 text-gray-700">
                Sequence {seqDiff.sequenceId}: {seqDiff.initialTimestamp} to{" "}
                {seqDiff.finalTimestamp} (
                {seqDiff.isRegeneration ? "Regeneration" : "Initial Generation"}
                )
              </h2>
              <div className="mb-4 text-gray-600">
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
                        <th className="p-2 border">Quote</th>
                        <th className="p-2 border">Code</th>
                      </tr>
                    </thead>
                    <tbody>
                      {seqDiff.changes.inserted.map((result) => (
                        <tr key={result.id}>
                          <td className="p-2 border">{result.id}</td>
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
                {Object.entries(groupedUpdates).length > 0 ? (
                  Object.entries(groupedUpdates).map(([type, changes]) => (
                    <div key={type} className="mb-4">
                      <h5 className="text-sm font-medium text-gray-500">
                        {type
                          .replace(/_/g, " ")
                          .replace(/\b\w/g, (c) => c.toUpperCase())}
                      </h5>
                      <table className="table-auto w-full border-collapse border border-gray-300 mb-2">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="p-2 border">Result ID</th>
                            <th className="p-2 border">Code</th>
                            <th className="p-2 border">Quote</th>
                            {type === "quote_changed" && (
                              <>
                                <th className="p-2 border">Old Quote</th>
                                <th className="p-2 border">New Quote</th>
                                <th className="p-2 border">Similarity</th>
                              </>
                            )}
                            {type === "code_changed" && (
                              <>
                                <th className="p-2 border">Old Code</th>
                                <th className="p-2 border">New Code</th>
                                <th className="p-2 border">Similarity</th>
                              </>
                            )}
                            {type === "explanation_changed" && (
                              <>
                                <th className="p-2 border">Old Explanation</th>
                                <th className="p-2 border">New Explanation</th>
                              </>
                            )}
                            {type === "is_marked_changed" && (
                              <>
                                <th className="p-2 border">Old Is Marked</th>
                                <th className="p-2 border">New Is Marked</th>
                              </>
                            )}
                            {type === "chat_history_changed" && (
                              <th className="p-2 border">
                                Chat History Changed
                              </th>
                            )}
                            {type === "range_marker_changed" && (
                              <th className="p-2 border">
                                Range Marker Changed
                              </th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {changes.map((change, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="p-2 border">{change.resultId}</td>
                              <td className="p-2 border">{change.code}</td>
                              <td className="p-2 border">{change.quote}</td>
                              {type === "quote_changed" && (
                                <>
                                  <td className="p-2 border">
                                    {change.oldValue}
                                  </td>
                                  <td className="p-2 border">
                                    {change.newValue}
                                  </td>
                                  <td className="p-2 border">
                                    {change.similarity?.toFixed(3)}
                                  </td>
                                </>
                              )}
                              {type === "code_changed" && (
                                <>
                                  <td className="p-2 border">
                                    {change.oldValue}
                                  </td>
                                  <td className="p-2 border">
                                    {change.newValue}
                                  </td>
                                  <td className="p-2 border">
                                    {change.similarity?.toFixed(3)}
                                  </td>
                                </>
                              )}
                              {type === "explanation_changed" && (
                                <>
                                  <td className="p-2 border">
                                    {change.oldValue}
                                  </td>
                                  <td className="p-2 border">
                                    {change.newValue}
                                  </td>
                                </>
                              )}
                              {type === "is_marked_changed" && (
                                <>
                                  <td className="p-2 border">
                                    {change.oldValue ? "Yes" : "No"}
                                  </td>
                                  <td className="p-2 border">
                                    {change.newValue ? "Yes" : "No"}
                                  </td>
                                </>
                              )}
                              {type === "chat_history_changed" && (
                                <td className="p-2 border">Yes</td>
                              )}
                              {type === "range_marker_changed" && (
                                <td className="p-2 border">Yes</td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))
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
                        <th className="p-2 border">Quote</th>
                        <th className="p-2 border">Code</th>
                      </tr>
                    </thead>
                    <tbody>
                      {seqDiff.changes.deleted.map((result) => (
                        <tr key={result.id}>
                          <td className="p-2 border">{result.id}</td>
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
                                <th className="p-2 border">Quote</th>
                                <th className="p-2 border">Code</th>
                              </tr>
                            </thead>
                            <tbody>
                              {step.changes.inserted.map((result) => (
                                <tr key={result.id}>
                                  <td className="p-2 border">{result.id}</td>
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
                          Object.entries(
                            step.changes.updated.reduce((acc, change) => {
                              if (!acc[change.type]) {
                                acc[change.type] = [];
                              }
                              acc[change.type].push(change);
                              return acc;
                            }, {} as { [key: string]: FieldChange[] })
                          ).map(([type, changes]) => (
                            <div key={type} className="mb-4">
                              <h6 className="text-xs font-medium text-gray-400">
                                {type
                                  .replace(/_/g, " ")
                                  .replace(/\b\w/g, (c) => c.toUpperCase())}
                              </h6>
                              <table className="table-auto w-full border-collapse border border-gray-300 mb-2">
                                <thead>
                                  <tr className="bg-gray-100">
                                    <th className="p-2 border">Result ID</th>
                                    <th className="p-2 border">Code</th>
                                    <th className="p-2 border">Quote</th>
                                    {type === "quote_changed" && (
                                      <>
                                        <th className="p-2 border">
                                          Old Quote
                                        </th>
                                        <th className="p-2 border">
                                          New Quote
                                        </th>
                                        <th className="p-2 border">
                                          Similarity
                                        </th>
                                      </>
                                    )}
                                    {type === "code_changed" && (
                                      <>
                                        <th className="p-2 border">Old Code</th>
                                        <th className="p-2 border">New Code</th>
                                        <th className="p-2 border">
                                          Similarity
                                        </th>
                                      </>
                                    )}
                                    {type === "explanation_changed" && (
                                      <>
                                        <th className="p-2 border">
                                          Old Explanation
                                        </th>
                                        <th className="p-2 border">
                                          New Explanation
                                        </th>
                                      </>
                                    )}
                                    {type === "is_marked_changed" && (
                                      <>
                                        <th className="p-2 border">
                                          Old Is Marked
                                        </th>
                                        <th className="p-2 border">
                                          New Is Marked
                                        </th>
                                      </>
                                    )}
                                    {type === "chat_history_changed" && (
                                      <th className="p-2 border">
                                        Chat History Changed
                                      </th>
                                    )}
                                    {type === "range_marker_changed" && (
                                      <th className="p-2 border">
                                        Range Marker Changed
                                      </th>
                                    )}
                                  </tr>
                                </thead>
                                <tbody>
                                  {changes.map((change, index) => (
                                    <tr
                                      key={index}
                                      className="hover:bg-gray-50"
                                    >
                                      <td className="p-2 border">
                                        {change.resultId}
                                      </td>
                                      <td className="p-2 border">
                                        {change.code}
                                      </td>
                                      <td className="p-2 border">
                                        {change.quote}
                                      </td>
                                      {type === "quote_changed" && (
                                        <>
                                          <td className="p-2 border">
                                            {change.oldValue}
                                          </td>
                                          <td className="p-2 border">
                                            {change.newValue}
                                          </td>
                                          <td className="p-2 border">
                                            {change.similarity?.toFixed(3)}
                                          </td>
                                        </>
                                      )}
                                      {type === "code_changed" && (
                                        <>
                                          <td className="p-2 border">
                                            {change.oldValue}
                                          </td>
                                          <td className="p-2 border">
                                            {change.newValue}
                                          </td>
                                          <td className="p-2 border">
                                            {change.similarity?.toFixed(3)}
                                          </td>
                                        </>
                                      )}
                                      {type === "explanation_changed" && (
                                        <>
                                          <td className="p-2 border">
                                            {change.oldValue}
                                          </td>
                                          <td className="p-2 border">
                                            {change.newValue}
                                          </td>
                                        </>
                                      )}
                                      {type === "is_marked_changed" && (
                                        <>
                                          <td className="p-2 border">
                                            {change.oldValue ? "Yes" : "No"}
                                          </td>
                                          <td className="p-2 border">
                                            {change.newValue ? "Yes" : "No"}
                                          </td>
                                        </>
                                      )}
                                      {type === "chat_history_changed" && (
                                        <td className="p-2 border">Yes</td>
                                      )}
                                      {type === "range_marker_changed" && (
                                        <td className="p-2 border">Yes</td>
                                      )}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ))
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
                                <th className="p-2 border">Quote</th>
                                <th className="p-2 border">Code</th>
                              </tr>
                            </thead>
                            <tbody>
                              {step.changes.deleted.map((result) => (
                                <tr key={result.id}>
                                  <td className="p-2 border">{result.id}</td>
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
          );
        })
      )}
    </div>
  );
};

export default InitialCodingResultsDiffViewer;

import React, { useState, useEffect, useRef } from "react";
import { useDatabase } from "./context";
import { DatabaseRow, Context } from "../utils/types";

interface KeywordResult {
  id: string | null;
  word: string;
  description: string;
  inclusion_criteria: string;
  exclusion_criteria: string;
  isMarked: boolean | null;
}

interface FieldChange {
  type:
    | "word_changed"
    | "description_changed"
    | "inclusion_criteria_changed"
    | "exclusion_criteria_changed"
    | "is_marked_changed";
  resultId: string;
  oldValue: any;
  newValue: any;
  similarity?: number;
}

interface CRUDChanges {
  inserted: KeywordResult[];
  updated: FieldChange[];
  deleted: KeywordResult[];
}

interface StepChange {
  step: number;
  changes: CRUDChanges;
}

interface SequenceDiff {
  sequenceId: number;
  initialTimestamp: string;
  finalTimestamp: string;
  isRegeneration: boolean;
  changes: CRUDChanges;
  stepwiseChanges: StepChange[];
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

const safeParseState = (state: string): any => {
  try {
    return JSON.parse(state);
  } catch {
    return {};
  }
};

const groupEntriesIntoSequences = (entries: DatabaseRow[]): DatabaseRow[][] => {
  const sequences: DatabaseRow[][] = [];
  let currentSequence: DatabaseRow[] = [];
  for (const entry of entries) {
    const context = safeParseContext(entry.context);
    if (context.function === "keyword_table") {
      if (currentSequence.length > 0) sequences.push(currentSequence);
      currentSequence = [entry];
    } else if (
      context.function === "dispatchKeywordsTable" &&
      currentSequence.length > 0
    ) {
      currentSequence.push(entry);
    }
  }
  if (currentSequence.length > 0) sequences.push(currentSequence);
  return sequences;
};

const normalizeCriteria = (criteria: string | string[]): string => {
  return Array.isArray(criteria) ? criteria.join(", ") : criteria || "";
};

const extractResults = (
  state: any,
  stateType: "generation" | "dispatch"
): Map<string, KeywordResult> => {
  const results = new Map<string, KeywordResult>();
  if (typeof state === "string") {
    state = JSON.parse(state);
  }
  const resultsArray =
    stateType === "generation" ? state?.results : state?.current_state;
  if (Array.isArray(resultsArray)) {
    resultsArray.forEach((result: any) => {
      const key = result.id || result.word;
      if (key) {
        results.set(key, {
          id: result.id || null,
          word: result.word || "",
          description: result.description || "",
          inclusion_criteria: normalizeCriteria(result.inclusion_criteria),
          exclusion_criteria: normalizeCriteria(result.exclusion_criteria),
          isMarked: result.isMarked !== undefined ? result.isMarked : null,
        });
      }
    });
  }
  return results;
};

const mapInitialToIds = (
  initialResults: Map<string, KeywordResult>,
  firstDispatchResults: Map<string, KeywordResult>
): Map<string, KeywordResult> => {
  const mappedResults = new Map<string, KeywordResult>();
  initialResults.forEach((result, word) => {
    const dispatchResult = [...firstDispatchResults.values()].find(
      (dr) => dr.word === word
    );
    const key = dispatchResult?.id || word;
    mappedResults.set(key, {
      ...result,
      id: dispatchResult?.id || null,
      isMarked: dispatchResult?.isMarked ?? null,
    });
  });
  return mappedResults;
};

const computeChanges = async (
  prevResults: Map<string, KeywordResult>,
  currResults: Map<string, KeywordResult>,
  getSimilarity: (textA: string, textB: string) => Promise<number>
): Promise<CRUDChanges> => {
  const prevKeys = new Set(prevResults.keys());
  const currKeys = new Set(currResults.keys());

  const inserted = [...currKeys]
    .filter((key) => !prevKeys.has(key))
    .map((key) => currResults.get(key)!);
  const deleted = [...prevKeys]
    .filter((key) => !currKeys.has(key))
    .map((key) => prevResults.get(key)!);
  const updated: FieldChange[] = [];

  const commonKeys = [...prevKeys].filter((key) => currKeys.has(key));

  for (const key of commonKeys) {
    const prev = prevResults.get(key);
    const curr = currResults.get(key);
    if (prev && curr) {
      if (prev.word !== curr.word) {
        const similarity = await getSimilarity(prev.word, curr.word);
        updated.push({
          type: "word_changed",
          resultId: key,
          oldValue: prev.word,
          newValue: curr.word,
          similarity,
        });
      }
      if (prev.description !== curr.description) {
        const similarity = await getSimilarity(
          prev.description,
          curr.description
        );
        updated.push({
          type: "description_changed",
          resultId: key,
          oldValue: prev.description,
          newValue: curr.description,
          similarity,
        });
      }
      if (prev.inclusion_criteria !== curr.inclusion_criteria) {
        const similarity = await getSimilarity(
          prev.inclusion_criteria,
          curr.inclusion_criteria
        );
        updated.push({
          type: "inclusion_criteria_changed",
          resultId: key,
          oldValue: prev.inclusion_criteria,
          newValue: curr.inclusion_criteria,
          similarity,
        });
      }
      if (prev.exclusion_criteria !== curr.exclusion_criteria) {
        const similarity = await getSimilarity(
          prev.exclusion_criteria,
          curr.exclusion_criteria
        );
        updated.push({
          type: "exclusion_criteria_changed",
          resultId: key,
          oldValue: prev.exclusion_criteria,
          newValue: curr.exclusion_criteria,
          similarity,
        });
      }
      if (prev.isMarked !== curr.isMarked) {
        updated.push({
          type: "is_marked_changed",
          resultId: key,
          oldValue: prev.isMarked,
          newValue: curr.isMarked,
        });
      }
    }
  }

  return { inserted, updated, deleted };
};

const renderChangeDetails = (change: FieldChange): string => {
  let base = `Keyword ID: ${change.resultId}, `;
  switch (change.type) {
    case "word_changed":
      base += `Old Word: ${change.oldValue}, New Word: ${change.newValue}`;
      break;
    case "description_changed":
      base += `Description Changed from "${change.oldValue}" to "${change.newValue}"`;
      break;
    case "inclusion_criteria_changed":
      base += `inclusion Criteria Changed from "${change.oldValue}" to "${change.newValue}"`;
      break;
    case "exclusion_criteria_changed":
      base += `Exclusion Criteria Changed from "${change.oldValue}" to "${change.newValue}"`;
      break;
    case "is_marked_changed":
      base += `Old Is Marked: ${change.oldValue}, New Is Marked: ${change.newValue}`;
      break;
    default:
      return "";
  }
  if (change.similarity !== undefined) {
    base += `, Similarity: ${change.similarity.toFixed(3)}`;
  }
  return base;
};

const computeMetrics = async (
  initialResults: Map<string, KeywordResult>,
  finalResults: Map<string, KeywordResult>,
  getSimilarity: (a: string, b: string) => Promise<number>
): Promise<{ precision: number; recall: number }> => {
  const initialKeys = new Set(initialResults.keys());
  const finalKeys = new Set(finalResults.keys());

  const common = [...initialKeys].filter((k) => finalKeys.has(k));
  const inserted = [...finalKeys].filter((k) => !initialKeys.has(k));
  const deleted = [...initialKeys].filter((k) => !finalKeys.has(k));

  let TP = 0;
  for (const key of common) {
    const fin = finalResults.get(key)!;
    if (fin.isMarked === true) {
      const init = initialResults.get(key)!;

      const fields: Array<
        keyof Pick<
          KeywordResult,
          "word" | "description" | "inclusion_criteria" | "exclusion_criteria"
        >
      > = ["word", "description", "inclusion_criteria", "exclusion_criteria"];

      const sims = await Promise.all(
        fields.map((f) => getSimilarity(init[f] || "", fin[f] || ""))
      );

      const avgSim = sims.reduce((sum, x) => sum + x, 0) / sims.length;
      TP += sims.every((s) => s === 1) ? 1 : avgSim;
    }
  }

  const falseMarked = common.filter(
    (k) => finalResults.get(k)!.isMarked === false
  ).length;
  const FP = deleted.length + falseMarked;

  const FN = inserted.length;

  const precision = TP + FP > 0 ? TP / (TP + FP) : 0;
  const recall = TP + FN > 0 ? TP / (TP + FN) : 0;

  return { precision, recall };
};

const KeywordTableDiffViewer: React.FC = () => {
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
          WHERE json_extract(context, '$.function') IN ('keyword_table', 'dispatchKeywordsTable')
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
          const initialTimestamp = new Date(
            initialEntry.created_at
          ).toLocaleString();
          const finalEntry = sequence[sequence.length - 1];
          const finalTimestamp = new Date(
            finalEntry.created_at
          ).toLocaleString();

          const initialState = safeParseState(initialEntry.state);
          let initialResults = extractResults(initialState, "generation");

          let firstDispatchResults: Map<string, KeywordResult> | null = null;
          if (sequence.length > 1) {
            const firstDispatchState = safeParseState(sequence[1].state);
            firstDispatchResults = extractResults(
              firstDispatchState,
              "dispatch"
            );
            initialResults = mapInitialToIds(
              initialResults,
              firstDispatchResults
            );
          }

          const finalState =
            sequence.length > 1
              ? safeParseState(finalEntry.state)
              : initialState;
          const finalResults =
            sequence.length > 1
              ? extractResults(finalState, "dispatch")
              : initialResults;

          const changes = await computeChanges(
            initialResults,
            finalResults,
            getSimilarity
          );

          // const initialKeys = new Set(initialResults.keys());

          // const finalKeys = new Set(finalResults.keys());

          // const groundTruthPositives = new Set(
          //   [...finalResults.entries()]
          //     .filter(([_, res]) => res.isMarked === true)
          //     .map(([key]) => key)
          // );

          // const TP = [...initialKeys].filter((key) =>
          //   groundTruthPositives.has(key)
          // ).length;

          // const FP = [...initialKeys].filter(
          //   (key) => !groundTruthPositives.has(key)
          // ).length;

          // const FN = [...finalKeys].filter(
          //   (key) => !initialKeys.has(key)
          // ).length;

          // const precision = TP + FP > 0 ? TP / (TP + FP) : 0;

          // const recall = TP + FN > 0 ? TP / (TP + FN) : 0;

          const { precision, recall } = await computeMetrics(
            initialResults,
            finalResults,
            getSimilarity
          );

          const stepwiseChanges: StepChange[] = [];
          let prevResults = initialResults;
          for (let i = 1; i < sequence.length; i++) {
            const currState = safeParseState(sequence[i].state);
            const currResults = extractResults(currState, "dispatch");
            const stepChanges = await computeChanges(
              prevResults,
              currResults,
              getSimilarity
            );
            stepwiseChanges.push({ step: i, changes: stepChanges });
            prevResults = currResults;
          }

          return {
            sequenceId: seqIndex + 1,
            initialTimestamp,
            finalTimestamp,
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

  if (isLoading)
    return <p className="p-4 text-gray-600">Loading sequences...</p>;
  if (!isDatabaseLoaded)
    return <p className="p-4 text-gray-600">Please select a database first.</p>;

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">
        Keyword Table Diff Viewer
      </h1>
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
                Inserted Keywords
              </h4>
              {seqDiff.changes.inserted.length > 0 ? (
                <table className="table-auto w-full border-collapse border border-gray-300 mb-4">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="p-2 border">ID</th>
                      <th className="p-2 border">Word</th>
                      <th className="p-2 border">Description</th>
                      <th className="p-2 border">inclusion Criteria</th>
                      <th className="p-2 border">Exclusion Criteria</th>
                      <th className="p-2 border">Is Marked</th>
                    </tr>
                  </thead>
                  <tbody>
                    {seqDiff.changes.inserted.map((keyword) => (
                      <tr key={keyword.id || keyword.word}>
                        <td className="p-2 border">{keyword.id || "N/A"}</td>
                        <td className="p-2 border">{keyword.word}</td>
                        <td className="p-2 border">{keyword.description}</td>
                        <td className="p-2 border">
                          {keyword.inclusion_criteria}
                        </td>
                        <td className="p-2 border">
                          {keyword.exclusion_criteria}
                        </td>
                        <td className="p-2 border">
                          {keyword.isMarked === null
                            ? "N/A"
                            : keyword.isMarked
                            ? "Yes"
                            : "No"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="mb-2 text-gray-600">No inserted keywords.</p>
              )}

              <h4 className="text-md font-medium text-gray-600">
                Updated Keywords
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
                <p className="mb-2 text-gray-600">No updated keywords.</p>
              )}

              <h4 className="text-md font-medium text-gray-600">
                Deleted Keywords
              </h4>
              {seqDiff.changes.deleted.length > 0 ? (
                <table className="table-auto w-full border-collapse border border-gray-300 mb-4">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="p-2 border">ID</th>
                      <th className="p-2 border">Word</th>
                      <th className="p-2 border">Description</th>
                      <th className="p-2 border">inclusion Criteria</th>
                      <th className="p-2 border">Exclusion Criteria</th>
                      <th className="p-2 border">Is Marked</th>
                    </tr>
                  </thead>
                  <tbody>
                    {seqDiff.changes.deleted.map((keyword) => (
                      <tr key={keyword.id || keyword.word}>
                        <td className="p-2 border">{keyword.id || "N/A"}</td>
                        <td className="p-2 border">{keyword.word}</td>
                        <td className="p-2 border">{keyword.description}</td>
                        <td className="p-2 border">
                          {keyword.inclusion_criteria}
                        </td>
                        <td className="p-2 border">
                          {keyword.exclusion_criteria}
                        </td>
                        <td className="p-2 border">
                          {keyword.isMarked === null
                            ? "N/A"
                            : keyword.isMarked
                            ? "Yes"
                            : "No"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="mb-2 text-gray-600">No deleted keywords.</p>
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
                        Inserted Keywords
                      </h5>
                      {step.changes.inserted.length > 0 ? (
                        <table className="table-auto w-full border-collapse border border-gray-300 mb-2">
                          <thead>
                            <tr className="bg-gray-100">
                              <th className="p-2 border">ID</th>
                              <th className="p-2 border">Word</th>
                              <th className="p-2 border">Description</th>
                              <th className="p-2 border">inclusion Criteria</th>
                              <th className="p-2 border">Exclusion Criteria</th>
                              <th className="p-2 border">Is Marked</th>
                            </tr>
                          </thead>
                          <tbody>
                            {step.changes.inserted.map((keyword) => (
                              <tr key={keyword.id || keyword.word}>
                                <td className="p-2 border">
                                  {keyword.id || "N/A"}
                                </td>
                                <td className="p-2 border">{keyword.word}</td>
                                <td className="p-2 border">
                                  {keyword.description}
                                </td>
                                <td className="p-2 border">
                                  {keyword.inclusion_criteria}
                                </td>
                                <td className="p-2 border">
                                  {keyword.exclusion_criteria}
                                </td>
                                <td className="p-2 border">
                                  {keyword.isMarked === null
                                    ? "N/A"
                                    : keyword.isMarked
                                    ? "Yes"
                                    : "No"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="mb-2 text-gray-600">
                          No inserted keywords in this step.
                        </p>
                      )}

                      <h5 className="text-sm font-medium text-gray-500">
                        Updated Keywords
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
                                <td className="p-2 border">
                                  {renderChangeDetails(change)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="mb-2 text-gray-600">
                          No updated keywords in this step.
                        </p>
                      )}

                      <h5 className="text-sm font-medium text-gray-500">
                        Deleted Keywords
                      </h5>
                      {step.changes.deleted.length > 0 ? (
                        <table className="table-auto w-full border-collapse border border-gray-300 mb-2">
                          <thead>
                            <tr className="bg-gray-100">
                              <th className="p-2 border">ID</th>
                              <th className="p-2 border">Word</th>
                              <th className="p-2 border">Description</th>
                              <th className="p-2 border">inclusion Criteria</th>
                              <th className="p-2 border">Exclusion Criteria</th>
                              <th className="p-2 border">Is Marked</th>
                            </tr>
                          </thead>
                          <tbody>
                            {step.changes.deleted.map((keyword) => (
                              <tr key={keyword.id || keyword.word}>
                                <td className="p-2 border">
                                  {keyword.id || "N/A"}
                                </td>
                                <td className="p-2 border">{keyword.word}</td>
                                <td className="p-2 border">
                                  {keyword.description}
                                </td>
                                <td className="p-2 border">
                                  {keyword.inclusion_criteria}
                                </td>
                                <td className="p-2 border">
                                  {keyword.exclusion_criteria}
                                </td>
                                <td className="p-2 border">
                                  {keyword.isMarked === null
                                    ? "N/A"
                                    : keyword.isMarked
                                    ? "Yes"
                                    : "No"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="mb-2 text-gray-600">
                          No deleted keywords in this step.
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

export default KeywordTableDiffViewer;

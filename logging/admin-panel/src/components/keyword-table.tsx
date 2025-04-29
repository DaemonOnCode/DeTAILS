import React, { useState, useEffect, useRef } from "react";
import { useDatabase } from "./context";
import { DatabaseRow, Context } from "../utils/types";

interface ConceptOutlineResult {
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
  word: string;
  oldValue: any;
  newValue: any;
  similarity?: number;
}

interface CRUDChanges {
  inserted: ConceptOutlineResult[];
  updated: FieldChange[];
  deleted: ConceptOutlineResult[];
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
): Map<string, ConceptOutlineResult> => {
  const results = new Map<string, ConceptOutlineResult>();
  if (typeof state === "string") {
    state = JSON.parse(state);
  }
  const resultsArray =
    stateType === "generation" ? state?.results : state?.current_state;
  if (Array.isArray(resultsArray)) {
    resultsArray.forEach((result: any, index: number) => {
      const word = result.word || "";
      const id = result.id || null;
      const key = id || word || `temp-${index}`;
      if (!word) {
        console.warn(`[${stateType}] Empty word at index ${index}:`, result);
      } else if (word === "") {
        console.warn(
          `[${stateType}] Empty word string at index ${index}:`,
          result
        );
      }
      if (key) {
        results.set(key, {
          id,
          word,
          description: result.description || "",
          inclusion_criteria: normalizeCriteria(result.inclusion_criteria),
          exclusion_criteria: normalizeCriteria(result.exclusion_criteria),
          isMarked: result.isMarked !== undefined ? result.isMarked : null,
        });
      } else {
        console.error(
          `[${stateType}] Invalid result at index ${index}:`,
          result
        );
      }
    });
  }
  return results;
};

const mapInitialToIds = (
  initialResults: Map<string, ConceptOutlineResult>,
  firstDispatchResults: Map<string, ConceptOutlineResult>
): Map<string, ConceptOutlineResult> => {
  const mappedResults = new Map<string, ConceptOutlineResult>();
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
  prevResults: Map<string, ConceptOutlineResult>,
  currResults: Map<string, ConceptOutlineResult>,
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
      if (!curr.word) {
        console.warn(`Empty word for key ${key} in currResults:`, curr);
      }
      if (prev.word !== curr.word) {
        const similarity = await getSimilarity(prev.word, curr.word);
        updated.push({
          type: "word_changed",
          resultId: key,
          word: curr.word,
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
          word: curr.word,
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
          word: curr.word,
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
          word: curr.word,
          oldValue: prev.exclusion_criteria,
          newValue: curr.exclusion_criteria,
          similarity,
        });
      }
      if (prev.isMarked !== curr.isMarked) {
        updated.push({
          type: "is_marked_changed",
          resultId: key,
          word: curr.word,
          oldValue: prev.isMarked,
          newValue: curr.isMarked,
        });
      }
    }
  }

  return { inserted, updated, deleted };
};

const computeMetrics = async (
  initialResults: Map<string, ConceptOutlineResult>,
  finalResults: Map<string, ConceptOutlineResult>,
  getSimilarity: (a: string, b: string) => Promise<number>
): Promise<{ precision: number; recall: number }> => {
  const initialKeys = new Set(initialResults.keys());
  const finalKeys = new Set(finalResults.keys());

  const common = [...initialKeys].filter((k) => finalKeys.has(k));
  const inserted = [...finalKeys].filter((k) => !initialKeys.has(k));
  const deleted = [...initialKeys].filter((k) => !finalKeys.has(k));

  let unweightedTP = 0;

  let TP = 0;
  for (const key of common) {
    const fin = finalResults.get(key)!;
    if (fin.isMarked === true) {
      const init = initialResults.get(key)!;
      const fields: Array<keyof Omit<ConceptOutlineResult, "id" | "isMarked">> =
        ["word", "description", "inclusion_criteria", "exclusion_criteria"];
      const sims = await Promise.all(
        fields.map((f) => getSimilarity(init[f] || "", fin[f] || ""))
      );
      const avgSim = sims.reduce((sum, x) => sum + x, 0) / sims.length;
      TP += sims.every((s) => s === 1) ? 1 : avgSim;
      unweightedTP++;
    }
  }

  const falseMarked = common.filter(
    (k) => finalResults.get(k)!.isMarked === false
  ).length;
  const FP = deleted.length + falseMarked;
  const FN = [...inserted].filter(
    (key) => finalResults.get(key)!.isMarked === true
  ).length;

  const precision = TP + FP > 0 ? TP / (unweightedTP + FP) : 0;
  const recall = TP + FN > 0 ? TP / (unweightedTP + FN) : 0;

  return { precision, recall };
};

const ConceptOutlineTableDiffViewer: React.FC = () => {
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

          let firstDispatchResults: Map<string, ConceptOutlineResult> | null =
            null;
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

  const renderChangeDetails = (change: FieldChange): string => {
    const wordDisplay = change.word || "N/A";
    let base = `Concept Outline ID: ${change.resultId}, Word: ${wordDisplay}, `;
    switch (change.type) {
      case "word_changed":
        base += `Old Word: ${change.oldValue || "N/A"}, New Word: ${
          change.newValue || "N/A"
        }`;
        break;
      case "description_changed":
        base += `Description Changed from "${change.oldValue || "N/A"}" to "${
          change.newValue || "N/A"
        }"`;
        break;
      case "inclusion_criteria_changed":
        base += `Inclusion Criteria Changed from "${
          change.oldValue || "N/A"
        }" to "${change.newValue || "N/A"}"`;
        break;
      case "exclusion_criteria_changed":
        base += `Exclusion Criteria Changed from "${
          change.oldValue || "N/A"
        }" to "${change.newValue || "N/A"}"`;
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

  if (isLoading)
    return <p className="p-4 text-gray-600">Loading sequences...</p>;
  if (!isDatabaseLoaded)
    return <p className="p-4 text-gray-600">Please select a database first.</p>;

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">
        Concept Outline Table Diff Viewer
      </h1>
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
                  <strong>Weighted Precision:</strong>{" "}
                  {seqDiff.precision.toFixed(3)}
                </p>
                <p className="mt-2">
                  <strong>Weighted Recall:</strong> {seqDiff.recall.toFixed(3)}
                </p>
                {/* <p className="mb-2 text-sm text-gray-500">
                  <strong>Weighted True Positives</strong>: The sum of
                  similarities for concept outlines present in both the initial
                  and final sets and marked true in the final set, where
                  similarity is 1 if all fields are identical, or the average
                  cosine similarity across fields otherwise.
                </p> */}
                <p className="mb-2 text-sm text-gray-500">
                  <strong>Weighted Precision</strong>: True Positives (Correct
                  from start i.e. 1 + cosine similarity of edited i.e. &lt; 1) /
                  Number of True positives (total no.) + False Positives
                  (deleted or marked false by user)
                  {/* The weighted true positives
                  divided by the number of initial concept outlines. */}
                </p>
                <p className="mb-4 text-sm text-gray-500">
                  <strong>Weighted Recall</strong>: True Positives (Correct from
                  start i.e. 1 + cosine similarity of edited i.e. &lt; 1) /
                  Number of True positives (total no.) + False Negatives (total
                  number of new rows added by user)
                  {/* The weighted true positives divided
                  by the number of selected concept outlines. */}
                </p>
              </div>
              <h3 className="text-lg font-medium mb-2 text-gray-700">
                Initial vs Final Changes
              </h3>
              <div>
                <h4 className="text-md font-medium text-gray-600">
                  Inserted Concept Outlines
                </h4>
                {seqDiff.changes.inserted.length > 0 ? (
                  <table className="table-auto w-full border-collapse border border-gray-300 mb-4">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="p-2 border">ID</th>
                        <th className="p-2 border">Word</th>
                        <th className="p-2 border">Description</th>
                        <th className="p-2 border">Inclusion Criteria</th>
                        <th className="p-2 border">Exclusion Criteria</th>
                        <th className="p-2 border">Is Marked</th>
                      </tr>
                    </thead>
                    <tbody>
                      {seqDiff.changes.inserted.map((keyword) => (
                        <tr key={keyword.id || keyword.word}>
                          <td className="p-2 border">{keyword.id || "N/A"}</td>
                          <td className="p-2 border">
                            {keyword.word || "N/A"}
                          </td>
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
                  <p className="mb-2 text-gray-600">
                    No inserted concept outlines.
                  </p>
                )}

                <h4 className="text-md font-medium text-gray-600">
                  Updated Concept Outlines
                </h4>
                {Object.entries(groupedUpdates).length > 0 ? (
                  Object.entries(groupedUpdates).map(([type, changes]) => (
                    <div key={type} className="mb-4">
                      <h5 className="text-sm font-medium text-gray-500">
                        {type.replace(/_/g, " ").charAt(0).toUpperCase() +
                          type.replace(/_/g, " ").slice(1)}
                      </h5>
                      <table className="table-auto w-full border-collapse border border-gray-300 mb-2">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="p-2 border">Concept Outline ID</th>
                            <th className="p-2 border">Word</th>
                            {type !== "is_marked_changed" && (
                              <th className="p-2 border">Old Value</th>
                            )}
                            {type !== "is_marked_changed" && (
                              <th className="p-2 border">New Value</th>
                            )}
                            {type !== "is_marked_changed" && (
                              <th className="p-2 border">Similarity</th>
                            )}
                            {type === "is_marked_changed" && (
                              <th className="p-2 border">Old Is Marked</th>
                            )}
                            {type === "is_marked_changed" && (
                              <th className="p-2 border">New Is Marked</th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {changes.map((change, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="p-2 border">{change.resultId}</td>
                              <td className="p-2 border">
                                {change.word || "N/A"}
                              </td>
                              {type !== "is_marked_changed" && (
                                <td className="p-2 border">
                                  {change.oldValue || "N/A"}
                                </td>
                              )}
                              {type !== "is_marked_changed" && (
                                <td className="p-2 border">
                                  {change.newValue || "N/A"}
                                </td>
                              )}
                              {type !== "is_marked_changed" && (
                                <td className="p-2 border">
                                  {change.similarity?.toFixed(3) || "-"}
                                </td>
                              )}
                              {type === "is_marked_changed" && (
                                <td className="p-2 border">
                                  {change.oldValue ? "Yes" : "No"}
                                </td>
                              )}
                              {type === "is_marked_changed" && (
                                <td className="p-2 border">
                                  {change.newValue ? "Yes" : "No"}
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))
                ) : (
                  <p className="mb-2 text-gray-600">
                    No updated concept outlines.
                  </p>
                )}

                <h4 className="text-md font-medium text-gray-600">
                  Deleted Concept Outlines
                </h4>
                {seqDiff.changes.deleted.length > 0 ? (
                  <table className="table-auto w-full border-collapse border border-gray-300 mb-4">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="p-2 border">ID</th>
                        <th className="p-2 border">Word</th>
                        <th className="p-2 border">Description</th>
                        <th className="p-2 border">Inclusion Criteria</th>
                        <th className="p-2 border">Exclusion Criteria</th>
                        <th className="p-2 border">Is Marked</th>
                      </tr>
                    </thead>
                    <tbody>
                      {seqDiff.changes.deleted.map((keyword) => (
                        <tr key={keyword.id || keyword.word}>
                          <td className="p-2 border">{keyword.id || "N/A"}</td>
                          <td className="p-2 border">
                            {keyword.word || "N/A"}
                          </td>
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
                  <p className="mb-2 text-gray-600">
                    No deleted concept outlines.
                  </p>
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
                          Inserted Concept Outlines
                        </h5>
                        {step.changes.inserted.length > 0 ? (
                          <table className="table-auto w-full border-collapse border border-gray-300 mb-2">
                            <thead>
                              <tr className="bg-gray-100">
                                <th className="p-2 border">ID</th>
                                <th className="p-2 border">Word</th>
                                <th className="p-2 border">Description</th>
                                <th className="p-2 border">
                                  Inclusion Criteria
                                </th>
                                <th className="p-2 border">
                                  Exclusion Criteria
                                </th>
                                <th className="p-2 border">Is Marked</th>
                              </tr>
                            </thead>
                            <tbody>
                              {step.changes.inserted.map((keyword) => (
                                <tr key={keyword.id || keyword.word}>
                                  <td className="p-2 border">
                                    {keyword.id || "N/A"}
                                  </td>
                                  <td className="p-2 border">
                                    {keyword.word || "N/A"}
                                  </td>
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
                            No inserted concept outlines in this step.
                          </p>
                        )}

                        <h5 className="text-sm font-medium text-gray-500">
                          Updated Concept Outlines
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
                            No updated concept outlines in this step.
                          </p>
                        )}

                        <h5 className="text-sm font-medium text-gray-500">
                          Deleted Concept Outlines
                        </h5>
                        {step.changes.deleted.length > 0 ? (
                          <table className="table-auto w-full border-collapse border border-gray-300 mb-2">
                            <thead>
                              <tr className="bg-gray-100">
                                <th className="p-2 border">ID</th>
                                <th className="p-2 border">Word</th>
                                <th className="p-2 border">Description</th>
                                <th className="p-2 border">
                                  Inclusion Criteria
                                </th>
                                <th className="p-2 border">
                                  Exclusion Criteria
                                </th>
                                <th className="p-2 border">Is Marked</th>
                              </tr>
                            </thead>
                            <tbody>
                              {step.changes.deleted.map((keyword) => (
                                <tr key={keyword.id || keyword.word}>
                                  <td className="p-2 border">
                                    {keyword.id || "N/A"}
                                  </td>
                                  <td className="p-2 border">
                                    {keyword.word || "N/A"}
                                  </td>
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
                            No deleted concept outlines in this step.
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

export default ConceptOutlineTableDiffViewer;

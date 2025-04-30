import React, { useState, useEffect } from "react";
import { useDatabase } from "./context";
import { DatabaseRow, Context } from "../utils/types";

interface Keyword {
  id: string;
  word: string;
  description?: string;
  inclusion_criteria?: string[];
  exclusion_criteria?: string[];
}

interface KeywordChange {
  type: "inserted" | "deleted" | "updated";
  keywordId: string;
  word?: string;
  updatedFields?: { [key: string]: { from: any; to: any } };
  similarity?: number;
}

interface SequenceKeywordChange extends KeywordChange {
  step: number;
}

interface SelectionChange {
  type: "selected" | "deselected";
  keywordId: string;
  word: string;
}

interface SequenceDiff {
  sequenceId: number;
  initialTimestamp: string;
  finalTimestamp: string;
  isRegeneration: boolean;
  keywordChanges: SequenceKeywordChange[];
  selectionChanges: SelectionChange[];
  stepwiseKeywordChanges: { step: number; changes: KeywordChange[] }[];
  stepwiseSelectionChanges: { step: number; changes: SelectionChange[] }[];
  totalKeywordChanges: number;
  totalSelectionChanges: number;
  metrics: {
    initial_keywords: number;
    selected_keywords: number;
    TP: number;
    WTP: string;
    P: string;
    R: string;
    F1: string;
    P_w: string;
    R_w: string;
    F1_w: string;
    acceptance_rate: string;
    update_rate: string;
    deletion_rate: string;
  };
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
    if (context.function === "keyword_cloud_table") {
      if (currentSequence.length > 0) sequences.push(currentSequence);
      currentSequence = [entry];
    } else if (
      (context.function === "setSelectedKeywords" ||
        context.function === "setKeywords") &&
      currentSequence.length > 0
    ) {
      currentSequence.push(entry);
    }
  }
  if (currentSequence.length > 0) sequences.push(currentSequence);
  return sequences;
};

const extractKeywords = (state: any): Map<string, Keyword> => {
  const keywords = new Map<string, Keyword>();
  const parsedState = typeof state === "string" ? JSON.parse(state) : state;
  let keywordArray: any[] = [];

  if (parsedState.keywords && Array.isArray(parsedState.keywords)) {
    keywordArray = parsedState.keywords;
  } else if (
    parsedState.current_state &&
    Array.isArray(parsedState.current_state) &&
    parsedState.current_state.every((kw: any) => kw.id && kw.word)
  ) {
    keywordArray = parsedState.current_state;
  }

  keywordArray.forEach((kw: any) => {
    if (kw.id && kw.id !== "Unknown") {
      keywords.set(kw.id, {
        id: kw.id,
        word: kw.word,
        description: kw.description || "",
        inclusion_criteria: kw.inclusion_criteria || [],
        exclusion_criteria: kw.exclusion_criteria || [],
      });
    }
  });
  return keywords;
};

const extractSelectedKeywords = (state: any): Set<string> => {
  const selected = new Set<string>();
  const parsedState = typeof state === "string" ? JSON.parse(state) : state;
  const currentState = parsedState.current_state;
  if (Array.isArray(currentState)) {
    currentState.forEach((id: string) => selected.add(id));
  }
  return selected;
};

const computeKeywordChanges = (
  prevKeywords: Map<string, Keyword>,
  currKeywords: Map<string, Keyword>
): KeywordChange[] => {
  const changes: KeywordChange[] = [];
  prevKeywords.forEach((prevKw, id) => {
    if (!currKeywords.has(id)) {
      changes.push({ type: "deleted", keywordId: id, word: prevKw.word });
    }
  });
  currKeywords.forEach((currKw, id) => {
    if (!prevKeywords.has(id)) {
      changes.push({ type: "inserted", keywordId: id, word: currKw.word });
    } else {
      const prevKw = prevKeywords.get(id)!;
      if (prevKw.word !== currKw.word) {
        changes.push({
          type: "updated",
          keywordId: id,
          word: currKw.word,
          updatedFields: { word: { from: prevKw.word, to: currKw.word } },
        });
      }
    }
  });
  return changes;
};

const computeSelectionChanges = (
  prevSelected: Set<string>,
  currSelected: Set<string>,
  keywords: Map<string, Keyword>
): SelectionChange[] => {
  const changes: SelectionChange[] = [];
  prevSelected.forEach((id) => {
    if (!currSelected.has(id) && keywords.has(id)) {
      changes.push({
        type: "deselected",
        keywordId: id,
        word: keywords.get(id)!.word,
      });
    }
  });
  currSelected.forEach((id) => {
    if (!prevSelected.has(id) && keywords.has(id)) {
      changes.push({
        type: "selected",
        keywordId: id,
        word: keywords.get(id)!.word,
      });
    }
  });
  return changes;
};

const formatUpdatedFields = (updatedFields?: {
  [key: string]: { from: any; to: any };
}) => {
  if (!updatedFields) return "-";
  return Object.entries(updatedFields)
    .map(([key, value]) => `${key}: ${value.from} → ${value.to}`)
    .join(", ");
};

const RelatedConceptsDiffViewer: React.FC = () => {
  const {
    isDatabaseLoaded,
    executeQuery,
    selectedWorkspaceId,
    calculateSimilarity,
  } = useDatabase();
  const [sequences, setSequences] = useState<DatabaseRow[][]>([]);
  const [sequenceDiffs, setSequenceDiffs] = useState<SequenceDiff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openSteps, setOpenSteps] = useState<{ [key: string]: boolean }>({});

  const toggleStep = (sequenceId: number, step: number) => {
    const key = `${sequenceId}-${step}`;
    setOpenSteps((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    const fetchEntries = async () => {
      setIsLoading(true);
      try {
        const query = `
          SELECT * FROM state_dumps
          WHERE json_extract(context, '$.function') IN ('keyword_cloud_table', 'setSelectedKeywords', 'setKeywords')
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
      const normCache = new Map<string, number>();

      const getNorm = async (word: string): Promise<number> => {
        if (normCache.has(word)) return normCache.get(word)!;
        const squaredNorm = await calculateSimilarity(word, word);
        const norm = Math.sqrt(squaredNorm);
        normCache.set(word, norm);
        return norm;
      };

      const computedDiffs = await Promise.all(
        sequences.map(async (sequence, seqIndex) => {
          const initialEntry = sequence[0];
          const initialContext = safeParseContext(initialEntry.context);
          const isRegeneration = initialContext.run === "regenerate";
          const initialState = JSON.parse(initialEntry.state);
          const initialKeywords = extractKeywords(initialState);
          let prevKeywords = initialKeywords;
          let prevSelected = new Set<string>();

          const stepwiseKeywordChanges: {
            step: number;
            changes: KeywordChange[];
          }[] = [];
          const stepwiseSelectionChanges: {
            step: number;
            changes: SelectionChange[];
          }[] = [];

          for (let i = 0; i < sequence.length - 1; i++) {
            const nextEntry = sequence[i + 1];
            const nextContext = safeParseContext(nextEntry.context);
            const nextState = JSON.parse(nextEntry.state);

            if (nextContext.function === "setKeywords") {
              const nextKeywords = extractKeywords(nextState);
              const stepChanges = computeKeywordChanges(
                prevKeywords,
                nextKeywords
              );
              for (const change of stepChanges) {
                if (change.type === "updated" && change.updatedFields?.word) {
                  const dotProduct = await calculateSimilarity(
                    change.updatedFields.word.from,
                    change.updatedFields.word.to
                  );
                  const normPrev = await getNorm(
                    change.updatedFields.word.from
                  );
                  const normCurr = await getNorm(change.updatedFields.word.to);
                  change.similarity =
                    normPrev * normCurr > 0
                      ? dotProduct / (normPrev * normCurr)
                      : 0;
                }
              }
              if (stepChanges.length > 0) {
                stepwiseKeywordChanges.push({
                  step: i + 1,
                  changes: stepChanges,
                });
              }
              prevKeywords = nextKeywords;
            } else if (nextContext.function === "setSelectedKeywords") {
              const nextSelected = extractSelectedKeywords(nextState);
              const stepChanges = computeSelectionChanges(
                prevSelected,
                nextSelected,
                prevKeywords
              );
              if (stepChanges.length > 0) {
                stepwiseSelectionChanges.push({
                  step: i + 1,
                  changes: stepChanges,
                });
              }
              prevSelected = nextSelected;
            }
          }

          const keywordChanges: SequenceKeywordChange[] =
            stepwiseKeywordChanges.flatMap((step) =>
              step.changes.map((change) => ({ ...change, step: step.step }))
            );

          const totalKeywordChanges = stepwiseKeywordChanges.reduce(
            (sum, step) => sum + step.changes.length,
            0
          );
          const totalSelectionChanges = stepwiseSelectionChanges.reduce(
            (sum, step) => sum + step.changes.length,
            0
          );

          const latestKeywords = prevKeywords;
          const latestSelected = prevSelected;
          const I = new Set(initialKeywords.keys());
          const S = latestSelected;
          const commonIds = new Set([...I].filter((x) => S.has(x)));
          let TP = 0;
          let WTP = 0;
          let kept_count = 0;
          let updated_count = 0;

          for (const id of commonIds) {
            if (latestKeywords.has(id) && initialKeywords.has(id)) {
              const initialWord = initialKeywords.get(id)!.word;
              const finalWord = latestKeywords.get(id)!.word;
              if (initialWord === finalWord) {
                TP += 1;
                WTP += 1;
                kept_count += 1;
              } else {
                const dotProduct = await calculateSimilarity(
                  initialWord,
                  finalWord
                );
                const normInitial = await getNorm(initialWord);
                const normFinal = await getNorm(finalWord);
                const similarity =
                  normInitial * normFinal > 0
                    ? dotProduct / (normInitial * normFinal)
                    : 0;
                WTP += similarity;
                updated_count += 1;
              }
            }
          }

          const I_size = I.size;
          const S_size = S.size;
          const P = I_size > 0 ? TP / I_size : 0;
          const R = S_size > 0 ? TP / S_size : 0;
          const F1 = P + R > 0 ? (2 * P * R) / (P + R) : 0;
          const P_w = I_size > 0 ? WTP / I_size : 0;
          const R_w = S_size > 0 ? WTP / S_size : 0;
          const F1_w = P_w + R_w > 0 ? (2 * P_w * R_w) / (P_w + R_w) : 0;
          const acceptance_rate = I_size > 0 ? kept_count / I_size : 0;
          const update_rate = I_size > 0 ? updated_count / I_size : 0;
          const deletion_rate =
            I_size > 0 ? (I_size - kept_count - updated_count) / I_size : 0;

          const metrics = {
            initial_keywords: I_size,
            selected_keywords: S_size,
            TP,
            WTP: WTP.toFixed(4),
            P: P.toFixed(4),
            R: R.toFixed(4),
            F1: F1.toFixed(4),
            P_w: P_w.toFixed(4),
            R_w: R_w.toFixed(4),
            F1_w: F1_w.toFixed(4),
            acceptance_rate: acceptance_rate.toFixed(4),
            update_rate: update_rate.toFixed(4),
            deletion_rate: deletion_rate.toFixed(4),
          };

          return {
            sequenceId: seqIndex + 1,
            initialTimestamp: new Date(
              initialEntry.created_at
            ).toLocaleString(),
            finalTimestamp: new Date(
              sequence[sequence.length - 1].created_at
            ).toLocaleString(),
            isRegeneration,
            keywordChanges,
            selectionChanges: computeSelectionChanges(
              new Set(),
              latestSelected,
              latestKeywords
            ),
            stepwiseKeywordChanges,
            stepwiseSelectionChanges,
            totalKeywordChanges,
            totalSelectionChanges,
            metrics,
          };
        })
      );

      setSequenceDiffs(computedDiffs);
    };

    if (sequences.length > 0) computeDiffs();
    else setSequenceDiffs([]);
  }, [sequences, calculateSimilarity]);

  const metricNames: Record<string, { name: string; formula: string }> = {
    initial_keywords: {
      name: "Initial Related Concepts",
      formula: "The total number of  related concepts in the initial set.",
    },
    selected_keywords: {
      name: "Selected Related Concepts",
      formula: "The total number of related concepts in the selected set.",
    },
    TP: {
      name: "True Positives",
      formula:
        "The number of related concepts that are present in both the initial and selected sets with unchanged words.",
    },
    WTP: {
      name: "Weighted True Positives",
      formula:
        "The sum of similarities for related concepts in both sets, where similarity is 1 if the word is unchanged, or cosine similarity between 0 and 1 if updated.",
    },
    P: {
      name: "Precision",
      formula:
        "The ratio of true positives to the number of initial related concepts.",
    },
    R: {
      name: "Recall",
      formula:
        "The ratio of true positives to the number of selected related concepts.",
    },
    F1: {
      name: "F1 Score",
      formula: "The harmonic mean of precision and recall.",
    },
    P_w: {
      name: "Weighted Precision",
      formula:
        "The weighted true positives divided by the number of initial related concepts.",
    },
    R_w: {
      name: "Weighted Recall",
      formula:
        "The weighted true positives divided by the number of selected related concepts.",
    },
    F1_w: {
      name: "Weighted F1 Score",
      formula: "The harmonic mean of weighted precision and weighted recall.",
    },
    acceptance_rate: {
      name: "Acceptance Rate",
      formula:
        "The proportion of initial related concepts that were kept unchanged in the selected set.",
    },
    update_rate: {
      name: "Update Rate",
      formula:
        "The proportion of initial related concepts that were updated in the selected set.",
    },
    deletion_rate: {
      name: "Deletion Rate",
      formula:
        "The proportion of initial related concepts that were deleted and not present in the selected set.",
    },
  };

  if (isLoading)
    return <p className="p-4 text-gray-600">Loading sequences...</p>;
  if (!isDatabaseLoaded)
    return <p className="p-4 text-gray-600">Please select a database first.</p>;

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">
        Related Concepts Diff Viewer
      </h1>
      <p className="mb-4 text-gray-600">
        Total number of regenerations:{" "}
        {sequenceDiffs.filter((seq) => seq.isRegeneration).length}
      </p>
      {sequenceDiffs.length === 0 ? (
        <p className="text-gray-600">No sequences found.</p>
      ) : (
        sequenceDiffs.map((seqDiff) => {
          const allStepChanges = [
            ...seqDiff.stepwiseKeywordChanges.map((change) => ({
              step: change.step,
              type: "keyword" as const,
              changes: change.changes,
            })),
            ...seqDiff.stepwiseSelectionChanges.map((change) => ({
              step: change.step,
              type: "selection" as const,
              changes: change.changes,
            })),
          ].sort((a, b) => a.step - b.step);

          return (
            <div key={seqDiff.sequenceId} className="mb-8">
              <h2 className="text-xl font-semibold mb-2 text-gray-700">
                Sequence {seqDiff.sequenceId}: {seqDiff.initialTimestamp} to{" "}
                {seqDiff.finalTimestamp} (
                {seqDiff.isRegeneration ? "Regeneration" : "Initial Generation"}
                )
              </h2>

              <div className="mb-6">
                <h3 className="text-lg font-medium mb-2 text-gray-700">
                  Related Concept Changes
                </h3>
                {seqDiff.keywordChanges.length > 0 ? (
                  <table className="table-auto w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="p-2 border">Step</th>
                        <th className="p-2 border">Type</th>
                        <th className="p-2 border">Related Concept ID</th>
                        <th className="p-2 border">Word</th>
                        <th className="p-2 border">Updated Fields</th>
                        <th className="p-2 border">Similarity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {seqDiff.keywordChanges.map((change, index) =>
                        change.type === "updated" ? (
                          <tr
                            key={`${change.step}-${change.keywordId}-${change.type}-${index}`}
                            className="hover:bg-gray-50"
                          >
                            <td className="p-2 border">{change.step}</td>
                            <td className="p-2 border">{change.type}</td>
                            <td className="p-2 border">{change.keywordId}</td>
                            <td className="p-2 border">{change.word || "-"}</td>
                            <td className="p-2 border">
                              {change.updatedFields
                                ? formatUpdatedFields(change.updatedFields)
                                : "-"}
                            </td>
                            <td className="p-2 border">
                              {change.similarity !== undefined
                                ? change.similarity.toFixed(4)
                                : "-"}
                            </td>
                          </tr>
                        ) : null
                      )}
                    </tbody>
                  </table>
                ) : (
                  <p className="mb-4 text-gray-600">
                    No related concept changes.
                  </p>
                )}
                <div className="mt-4">
                  <h4 className="text-md font-medium mb-2 text-gray-700">
                    Metrics
                  </h4>
                  <table className="table-auto w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="p-2 border">Metric</th>
                        <th className="p-2 border">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(seqDiff.metrics).map(([key, value]) => (
                        <tr key={key}>
                          <td className="p-2 border">
                            {metricNames[key]
                              ? `${metricNames[key].name} (${metricNames[key].formula})`
                              : key}
                          </td>
                          <td className="p-2 border">{value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {seqDiff.selectionChanges.length > 0 ? (
                <div className="mb-6">
                  <h3 className="text-lg font-medium mb-2 text-gray-700">
                    Selection Changes
                  </h3>
                  <table className="table-auto w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="p-2 border">Type</th>
                        <th className="p-2 border">Related Concept ID</th>
                        <th className="p-2 border">Word</th>
                      </tr>
                    </thead>
                    <tbody>
                      {seqDiff.selectionChanges.map((change, index) => (
                        <tr
                          key={change.keywordId || `selection-change-${index}`}
                          className="hover:bg-gray-50"
                        >
                          <td className="p-2 border">{change.type}</td>
                          <td className="p-2 border">{change.keywordId}</td>
                          <td className="p-2 border">{change.word}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mb-4 text-gray-600">
                  No overall selection changes.
                  {seqDiff.totalSelectionChanges > 0 && (
                    <span>
                      {" "}
                      However, there were {seqDiff.totalSelectionChanges}{" "}
                      intermediate selection changes. Check "Stepwise Changes"
                      below.
                    </span>
                  )}
                </p>
              )}

              <h3 className="text-lg font-medium mb-2 text-gray-700">
                Stepwise Changes
              </h3>
              {allStepChanges.length > 0 ? (
                allStepChanges.map((stepChange) => {
                  const key = `${seqDiff.sequenceId}-${stepChange.step}`;
                  const isOpen = openSteps[key];
                  return (
                    <div key={stepChange.step} className="mb-4">
                      <h4
                        className="text-md font-medium text-gray-600 cursor-pointer"
                        onClick={() =>
                          toggleStep(seqDiff.sequenceId, stepChange.step)
                        }
                      >
                        Step {stepChange.step}:{" "}
                        {stepChange.type.charAt(0).toUpperCase() +
                          stepChange.type.slice(1)}{" "}
                        Changes {isOpen ? "▲" : "▼"}
                      </h4>
                      {isOpen && (
                        <div>
                          {stepChange.type === "keyword" ? (
                            <table className="table-auto w-full border-collapse border border-gray-300">
                              <thead>
                                <tr className="bg-gray-100">
                                  <th className="p-2 border">Type</th>
                                  <th className="p-2 border">
                                    Related Concept ID
                                  </th>
                                  <th className="p-2 border">Word</th>
                                  <th className="p-2 border">Updated Fields</th>
                                  <th className="p-2 border">Similarity</th>
                                </tr>
                              </thead>
                              <tbody>
                                {stepChange.changes.map((change, index) => (
                                  <tr
                                    key={
                                      change.keywordId ||
                                      `step-${stepChange.step}-keyword-${index}`
                                    }
                                    className="hover:bg-gray-50"
                                  >
                                    <td className="p-2 border">
                                      {change.type}
                                    </td>
                                    <td className="p-2 border">
                                      {change.keywordId}
                                    </td>
                                    <td className="p-2 border">
                                      {change.word || "-"}
                                    </td>
                                    <td className="p-2 border">
                                      {change.updatedFields
                                        ? formatUpdatedFields(
                                            change.updatedFields
                                          )
                                        : "-"}
                                    </td>
                                    <td className="p-2 border">
                                      {change.similarity !== undefined
                                        ? change.similarity.toFixed(4)
                                        : "-"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <table className="table-auto w-full border-collapse border border-gray-300">
                              <thead>
                                <tr className="bg-gray-100">
                                  <th className="p-2 border">Type</th>
                                  <th className="p-2 border">
                                    Related Concept ID
                                  </th>
                                  <th className="p-2 border">Word</th>
                                </tr>
                              </thead>
                              <tbody>
                                {stepChange.changes.map((change, index) => (
                                  <tr
                                    key={
                                      change.keywordId ||
                                      `step-${stepChange.step}-selection-${index}`
                                    }
                                    className="hover:bg-gray-50"
                                  >
                                    <td className="p-2 border">
                                      {change.type}
                                    </td>
                                    <td className="p-2 border">
                                      {change.keywordId}
                                    </td>
                                    <td className="p-2 border">
                                      {change.word}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
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

export default RelatedConceptsDiffViewer;

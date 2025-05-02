import React, { useState, useEffect } from "react";
import { useDatabase } from "./context";
import { DatabaseRow, Context } from "../utils/types";

interface Concept {
  id: string;
  word: string;
  description?: string;
  inclusion_criteria?: string[];
  exclusion_criteria?: string[];
}

interface ConceptChange {
  type: "inserted" | "deleted" | "updated";
  conceptId: string;
  word?: string;
  updatedFields?: { [key: string]: { from: any; to: any } };
  similarity?: number;
}

interface SequenceConceptChange extends ConceptChange {
  step: number;
}

interface SelectionChange {
  type: "selected" | "deselected";
  conceptId: string;
  word: string;
}

interface Metrics {
  initial_concepts: number;
  selected_concepts: number;
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
}

interface SequenceDiff {
  sequenceId: number;
  initialTimestamp: string;
  finalTimestamp: string;
  conceptChanges: SequenceConceptChange[];
  selectionChanges: SelectionChange[];
  stepwiseConceptChanges: { step: number; changes: ConceptChange[] }[];
  stepwiseSelectionChanges: { step: number; changes: SelectionChange[] }[];
  totalConceptChanges: number;
  totalSelectionChanges: number;
  initialMetrics: Metrics;
  finalMetrics: Metrics;
  totalGenerated: number;
  totalSelected: number;
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
    if (
      context.function === "concept_cloud_table" &&
      context.run !== "regenerate"
    ) {
      if (currentSequence.length > 0) sequences.push(currentSequence);
      currentSequence = [entry];
    } else if (currentSequence.length > 0) {
      if (
        context.function === "setSelectedConcepts" ||
        context.function === "setConcepts" ||
        (context.function === "concept_cloud_table" &&
          context.run === "regenerate")
      ) {
        currentSequence.push(entry);
      }
    }
  }
  if (currentSequence.length > 0) sequences.push(currentSequence);
  return sequences;
};

const extractConcepts = (state: any): Map<string, Concept> => {
  const concepts = new Map<string, Concept>();
  const parsedState = typeof state === "string" ? JSON.parse(state) : state;
  let conceptArray: any[] = [];

  if (parsedState.concepts && Array.isArray(parsedState.concepts)) {
    conceptArray = parsedState.concepts;
  } else if (
    parsedState.current_state &&
    Array.isArray(parsedState.current_state) &&
    parsedState.current_state.every((kw: any) => kw.id && kw.word)
  ) {
    conceptArray = parsedState.current_state;
  }

  conceptArray.forEach((kw: any) => {
    if (kw.id && kw.id !== "Unknown") {
      concepts.set(kw.id, {
        id: kw.id,
        word: kw.word,
        description: kw.description || "",
        inclusion_criteria: kw.inclusion_criteria || [],
        exclusion_criteria: kw.exclusion_criteria || [],
      });
    }
  });
  return concepts;
};

const extractSelectedConcepts = (state: any): Set<string> => {
  const selected = new Set<string>();
  const parsedState = typeof state === "string" ? JSON.parse(state) : state;
  const currentState = parsedState.current_state;
  if (Array.isArray(currentState)) {
    currentState.forEach((id: string) => selected.add(id));
  }
  return selected;
};

const computeConceptChanges = (
  prevConcepts: Map<string, Concept>,
  currConcepts: Map<string, Concept>
): ConceptChange[] => {
  const changes: ConceptChange[] = [];
  prevConcepts.forEach((prevKw, id) => {
    if (!currConcepts.has(id)) {
      changes.push({ type: "deleted", conceptId: id, word: prevKw.word });
    }
  });
  currConcepts.forEach((currKw, id) => {
    if (!prevConcepts.has(id)) {
      changes.push({ type: "inserted", conceptId: id, word: currKw.word });
    } else {
      const prevKw = prevConcepts.get(id)!;
      if (prevKw.word !== currKw.word) {
        changes.push({
          type: "updated",
          conceptId: id,
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
  concepts: Map<string, Concept>
): SelectionChange[] => {
  const changes: SelectionChange[] = [];
  prevSelected.forEach((id) => {
    if (!currSelected.has(id) && concepts.has(id)) {
      changes.push({
        type: "deselected",
        conceptId: id,
        word: concepts.get(id)!.word,
      });
    }
  });
  currSelected.forEach((id) => {
    if (!prevSelected.has(id) && concepts.has(id)) {
      changes.push({
        type: "selected",
        conceptId: id,
        word: concepts.get(id)!.word,
      });
    }
  });
  return changes;
};

const computeMetrics = async (
  initialConcepts: Map<string, Concept>,
  currentConcepts: Map<string, Concept>,
  currentSelected: Set<string>,
  calculateSimilarity: (w1: string, w2: string) => Promise<number>,
  getNorm: (w: string) => Promise<number>,
  totalGenerated: number
): Promise<Metrics> => {
  const I = new Set(initialConcepts.keys());
  const commonIds = new Set([...I].filter((id) => currentSelected.has(id)));

  let TP = 0;
  let WTP = 0;
  let kept_count = 0;
  let updated_count = 0;

  for (const id of commonIds) {
    const initWord = initialConcepts.get(id)!.word;
    const finalWord = currentConcepts.get(id)!.word;
    if (initWord === finalWord) {
      TP++;
      WTP++;
      kept_count++;
    } else {
      const dot = await calculateSimilarity(initWord, finalWord);
      const n1 = await getNorm(initWord);
      const n2 = await getNorm(finalWord);
      const sim = n1 * n2 > 0 ? dot / (n1 * n2) : 0;
      WTP += sim;
      updated_count++;
    }
  }

  // const totalGenerated = currentConcepts.size;
  console.log("total generations", totalGenerated);
  const totalSelectedInitials = commonIds.size;

  const P = totalGenerated > 0 ? TP / totalGenerated : 0;
  const R = totalSelectedInitials > 0 ? TP / totalSelectedInitials : 0;
  const F1 = P + R > 0 ? (2 * P * R) / (P + R) : 0;
  const P_w = totalGenerated > 0 ? WTP / totalGenerated : 0;
  const R_w = totalSelectedInitials > 0 ? WTP / totalSelectedInitials : 0;
  const F1_w = P_w + R_w > 0 ? (2 * P_w * R_w) / (P_w + R_w) : 0;

  const acceptance_rate = totalGenerated > 0 ? kept_count / totalGenerated : 0;
  const update_rate = totalGenerated > 0 ? updated_count / totalGenerated : 0;
  const deletion_rate =
    totalGenerated > 0
      ? (totalGenerated - kept_count - updated_count) / totalGenerated
      : 0;

  return {
    initial_concepts: initialConcepts.size,
    selected_concepts: totalSelectedInitials,
    TP,
    WTP: WTP.toString(),
    P: P.toString(),
    R: R.toString(),
    F1: F1.toString(),
    P_w: P_w.toString(),
    R_w: R_w.toString(),
    F1_w: F1_w.toString(),
    acceptance_rate: acceptance_rate.toString(),
    update_rate: update_rate.toString(),
    deletion_rate: deletion_rate.toString(),
  };
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
        const query = `           SELECT * FROM state_dumps
          WHERE json_extract(context, '$.function') IN ('concept_cloud_table', 'setSelectedConcepts', 'setConcepts')
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
          const conceptDump = sequence.find((e) => {
            const c = safeParseContext(e.context);
            return (
              c.function === "concept_cloud_table" && c.run !== "regenerate"
            );
          })!;

          const initialState = JSON.parse(conceptDump.state);
          const initialConcepts = extractConcepts(initialState);

          const mainTopicWord =
            initialState.main_topic || initialState.mainTopic;

          // Collect all IDs across the sequence where the word matches the main topic word
          const mainTopicIds = new Set<string>();
          for (const entry of sequence) {
            const cctx = safeParseContext(entry.context);
            if (
              cctx.function === "concept_cloud_table" ||
              cctx.function === "setConcepts"
            ) {
              const st = JSON.parse(entry.state);
              const stepConcepts = extractConcepts(st);
              for (const [id, concept] of stepConcepts) {
                if (concept.word === mainTopicWord) {
                  mainTopicIds.add(id);
                }
              }
            }
          }

          // Remove all main topic IDs from initial concepts
          mainTopicIds.forEach((id) => initialConcepts.delete(id));

          const generatedMap = new Map<string, string>();
          initialConcepts.forEach((c, id) => {
            generatedMap.set(id, c.word);
          });

          // const initialIds = new Set(initialConcepts.keys());
          let prevConcepts = initialConcepts;
          const aggregatedConcepts = new Map(initialConcepts);

          const initialSelected = new Set<string>();
          let prevSelected = initialSelected;
          const aggregatedSelected = new Set<string>();

          const initialMetrics = await computeMetrics(
            initialConcepts,
            initialConcepts,
            initialSelected,
            calculateSimilarity,
            getNorm,
            initialConcepts.size
          );

          const stepwiseConceptChanges: {
            step: number;
            changes: ConceptChange[];
          }[] = [];
          const stepwiseSelectionChanges: {
            step: number;
            changes: SelectionChange[];
          }[] = [];

          for (let i = 0; i < sequence.length - 1; i++) {
            const nextEntry = sequence[i + 1];
            const nextContext = safeParseContext(nextEntry.context);
            const nextState = JSON.parse(nextEntry.state);

            if (
              nextContext.function === "concept_cloud_table" &&
              nextContext.run === "regenerate"
            ) {
              const regenConcepts = extractConcepts(nextState);
              const regenChanges: ConceptChange[] = [];

              regenConcepts.forEach((newKw, id) => {
                if (!prevConcepts.has(id)) {
                  regenChanges.push({
                    type: "inserted",
                    conceptId: id,
                    word: newKw.word,
                  });
                } else {
                  const old = prevConcepts.get(id)!;
                  if (old.word !== newKw.word) {
                    regenChanges.push({
                      type: "updated",
                      conceptId: id,
                      word: newKw.word,
                      updatedFields: {
                        word: { from: old.word, to: newKw.word },
                      },
                    });
                  }
                }
              });

              for (const change of regenChanges) {
                if (change.type === "updated") {
                  const { from, to } = change.updatedFields!.word;
                  const dot = await calculateSimilarity(from, to);
                  const n1 = await getNorm(from);
                  const n2 = await getNorm(to);
                  change.similarity = n1 * n2 > 0 ? dot / (n1 * n2) : 0;
                }
              }

              if (regenChanges.length > 0) {
                stepwiseConceptChanges.push({
                  step: i + 1,
                  changes: regenChanges,
                });
              }

              for (const change of regenChanges) {
                if (mainTopicIds.has(change.conceptId)) continue;
                if (change.type === "inserted") {
                  aggregatedConcepts.set(
                    change.conceptId,
                    regenConcepts.get(change.conceptId)!
                  );
                  generatedMap.set(change.conceptId, change.word!);
                }
                if (change.type === "updated") {
                  const orig = aggregatedConcepts.get(change.conceptId)!;
                  aggregatedConcepts.set(change.conceptId, {
                    ...orig,
                    word: change.word!,
                  });
                  generatedMap.set(change.conceptId, change.word!);
                }
              }
              prevConcepts = new Map(aggregatedConcepts);
            } else if (nextContext.function === "setConcepts") {
              const nextConcepts = extractConcepts(nextState);
              const stepChanges = computeConceptChanges(
                prevConcepts,
                nextConcepts
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
                stepwiseConceptChanges.push({
                  step: i + 1,
                  changes: stepChanges,
                });
              }
              for (const change of stepChanges) {
                if (mainTopicIds.has(change.conceptId)) continue;
                switch (change.type) {
                  case "inserted":
                    aggregatedConcepts.set(
                      change.conceptId,
                      nextConcepts.get(change.conceptId)!
                    );
                    generatedMap.set(
                      change.conceptId,
                      nextConcepts.get(change.conceptId)!.word
                    );
                    break;
                  case "deleted":
                    aggregatedConcepts.delete(change.conceptId);
                    break;
                  case "updated":
                    const orig = aggregatedConcepts.get(change.conceptId)!;
                    aggregatedConcepts.set(change.conceptId, {
                      ...orig,
                      word: change.word!,
                    });
                    generatedMap.set(change.conceptId, change.word!);
                    break;
                }
              }
              prevConcepts = nextConcepts;
            } else if (nextContext.function === "setSelectedConcepts") {
              const rawNext = extractSelectedConcepts(nextState);
              const nextSelected = new Set(
                Array.from(rawNext).filter(
                  (id) => !mainTopicIds.has(id) && aggregatedConcepts.has(id)
                )
              );
              const stepChanges = computeSelectionChanges(
                prevSelected,
                nextSelected,
                prevConcepts
              );
              if (stepChanges.length > 0) {
                stepwiseSelectionChanges.push({
                  step: i + 1,
                  changes: stepChanges,
                });
              }
              for (const sel of stepChanges) {
                if (sel.type === "selected")
                  aggregatedSelected.add(sel.conceptId);
                else if (sel.type === "deselected")
                  aggregatedSelected.delete(sel.conceptId);
              }
              prevSelected = nextSelected;
            }
          }

          const conceptChanges: SequenceConceptChange[] =
            stepwiseConceptChanges.flatMap((step) =>
              step.changes.map((change) => ({ ...change, step: step.step }))
            );

          const totalConceptChanges = stepwiseConceptChanges.reduce(
            (sum, step) => sum + step.changes.length,
            0
          );
          const totalSelectionChanges = stepwiseSelectionChanges.reduce(
            (sum, step) => sum + step.changes.length,
            0
          );
          const totalGenerated = generatedMap.size;
          const totalSelected = Array.from(aggregatedSelected).filter(
            (id) => !mainTopicIds.has(id)
          ).length;

          const finalMetrics = await computeMetrics(
            initialConcepts,
            aggregatedConcepts,
            aggregatedSelected,
            calculateSimilarity,
            getNorm,
            totalGenerated
          );

          return {
            sequenceId: seqIndex + 1,
            initialTimestamp: new Date(conceptDump.created_at).toLocaleString(),
            finalTimestamp: new Date(
              sequence[sequence.length - 1].created_at
            ).toLocaleString(),
            conceptChanges,
            selectionChanges: computeSelectionChanges(
              initialSelected,
              aggregatedSelected,
              aggregatedConcepts
            ),
            stepwiseConceptChanges,
            stepwiseSelectionChanges,
            totalConceptChanges,
            totalSelectionChanges,
            initialMetrics,
            finalMetrics,
            totalGenerated,
            totalSelected,
          };
        })
      );

      setSequenceDiffs(computedDiffs);
    };

    if (sequences.length > 0) computeDiffs();
    else setSequenceDiffs([]);
  }, [sequences, calculateSimilarity]);

  const metricNames: Record<keyof Metrics, { name: string; formula: string }> =
    {
      initial_concepts: {
        name: "Initial Related Concepts",
        formula: "The total number of related concepts in the initial set.",
      },
      selected_concepts: {
        name: "Count of Selected Related Concepts",
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
          "The ratio of true positives to the number of total related concepts.",
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
          "The weighted true positives divided by the number of total related concepts.",
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
        name: "Selected without update Rate",
        formula:
          "The proportion of selected related concepts (not including updated) by the total generated concepts.",
      },
      update_rate: {
        name: "Updated then selected Rate",
        formula:
          "The proportion of updated related concepts which are present in selected related concepts divided by the total generated concepts.",
      },
      deletion_rate: {
        name: "Either deleted or not selected Rate",
        formula:
          "The proportion of unselected or deleted related concepts and not present in the total concepts.",
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
      {sequenceDiffs.length === 0 ? (
        <p className="text-gray-600">No sequences found.</p>
      ) : (
        sequenceDiffs.map((seqDiff) => {
          const allStepChanges = [
            ...seqDiff.stepwiseConceptChanges.map((change) => ({
              step: change.step,
              type: "concept" as const,
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
                {seqDiff.finalTimestamp}
              </h2>

              <div className="mb-6">
                <h3 className="text-lg font-medium mb-2 text-gray-700">
                  Related Concept Changes
                </h3>
                {seqDiff.conceptChanges.length > 0 ? (
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
                      {seqDiff.conceptChanges.map((change, index) =>
                        change.type === "updated" ? (
                          <tr
                            key={`${change.step}-${change.conceptId}-${change.type}-${index}`}
                            className="hover:bg-gray-50"
                          >
                            <td className="p-2 border">{change.step}</td>
                            <td className="p-2 border">{change.type}</td>
                            <td className="p-2 border">{change.conceptId}</td>
                            <td className="p-2 border">{change.word || "-"}</td>
                            <td className="p-2 border">
                              {change.updatedFields
                                ? formatUpdatedFields(change.updatedFields)
                                : "-"}
                            </td>
                            <td className="p-2 border">
                              {change.similarity !== undefined
                                ? change.similarity
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
                    Metrics: Initial vs Final
                  </h4>
                  <table className="table-auto w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="p-2 border">Metric</th>
                        <th className="p-2 border">Initial</th>
                        <th className="p-2 border">Final</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="p-2 border">
                          Total Generated Concepts (Initial + Regenerated)
                        </td>
                        <td className="p-2 border">—</td>
                        <td className="p-2 border">{seqDiff.totalGenerated}</td>
                      </tr>
                      <tr>
                        <td className="p-2 border">
                          Current Concepts Count (All before proceeding,
                          selected + unselected)
                        </td>
                        <td className="p-2 border">—</td>
                        <td className="p-2 border">{seqDiff.totalSelected}</td>
                      </tr>
                      {Object.keys(seqDiff.initialMetrics).map((key) => {
                        const metricKey = key as keyof Metrics;
                        return (
                          <tr key={metricKey}>
                            <td className="p-2 border">
                              {metricNames[metricKey]?.name || metricKey} (
                              {metricNames[metricKey]?.formula || metricKey})
                            </td>
                            <td className="p-2 border">
                              {seqDiff.initialMetrics[metricKey]}
                            </td>
                            <td className="p-2 border">
                              {seqDiff.finalMetrics[metricKey]}
                            </td>
                          </tr>
                        );
                      })}
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
                          key={change.conceptId || `selection-change-${index}`}
                          className="hover:bg-gray-50"
                        >
                          <td className="p-2 border">{change.type}</td>
                          <td className="p-2 border">{change.conceptId}</td>
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
                          {stepChange.type === "concept" ? (
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
                                      change.conceptId ||
                                      `step-${stepChange.step}-concept-${index}`
                                    }
                                    className="hover:bg-gray-50"
                                  >
                                    <td className="p-2 border">
                                      {change.type}
                                    </td>
                                    <td className="p-2 border">
                                      {change.conceptId}
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
                                        ? change.similarity
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
                                      change.conceptId ||
                                      `step-${stepChange.step}-selection-${index}`
                                    }
                                    className="hover:bg-gray-50"
                                  >
                                    <td className="p-2 border">
                                      {change.type}
                                    </td>
                                    <td className="p-2 border">
                                      {change.conceptId}
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

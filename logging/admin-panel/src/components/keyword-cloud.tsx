import React, { useState, useEffect } from "react";
import { useDatabase } from "./context";

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
  keywordChanges: KeywordChange[];
  selectionChanges: SelectionChange[];
  stepwiseKeywordChanges: { step: number; changes: KeywordChange[] }[];
  stepwiseSelectionChanges: { step: number; changes: SelectionChange[] }[];
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
  let keywordArray: any[] = [];
  const parsedState = typeof state === "string" ? JSON.parse(state) : state;
  const currentState = parsedState.current_state;
  if (parsedState.context && parsedState.context.keywords) {
    keywordArray = parsedState.context.keywords;
  } else if (currentState && Array.isArray(currentState)) {
    keywordArray = currentState;
  }
  keywordArray.forEach((kw: any) => {
    if (kw.id && kw.id !== "Unknown") {
      keywords.set(kw.id, {
        id: kw.id,
        word: kw.word,
        description: kw.description,
        inclusion_criteria: kw.inclusion_criteria,
        exclusion_criteria: kw.exclusion_criteria,
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
      const updatedFields: { [key: string]: { from: any; to: any } } = {};
      if (prevKw.word !== currKw.word) {
        updatedFields.word = { from: prevKw.word, to: currKw.word };
      }
      if (prevKw.description !== currKw.description) {
        updatedFields.description = {
          from: prevKw.description,
          to: currKw.description,
        };
      }
      if (
        JSON.stringify(prevKw.inclusion_criteria) !==
        JSON.stringify(currKw.inclusion_criteria)
      ) {
        updatedFields.inclusion_criteria = {
          from: prevKw.inclusion_criteria,
          to: currKw.inclusion_criteria,
        };
      }
      if (
        JSON.stringify(prevKw.exclusion_criteria) !==
        JSON.stringify(currKw.exclusion_criteria)
      ) {
        updatedFields.exclusion_criteria = {
          from: prevKw.exclusion_criteria,
          to: currKw.exclusion_criteria,
        };
      }
      if (Object.keys(updatedFields).length > 0) {
        changes.push({
          type: "updated",
          keywordId: id,
          word: currKw.word,
          updatedFields,
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

const KeywordsDiffViewer: React.FC = () => {
  const {
    isDatabaseLoaded,
    executeQuery,
    selectedWorkspaceId,
    calculateSimilarity,
  } = useDatabase();
  const [sequences, setSequences] = useState<DatabaseRow[][]>([]);
  const [sequenceDiffs, setSequenceDiffs] = useState<SequenceDiff[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
        if (normCache.has(word)) {
          return normCache.get(word)!;
        }
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
          const finalState =
            sequence.length > 1
              ? JSON.parse(sequence[sequence.length - 1].state)
              : initialState;

          const initialKeywords = extractKeywords(initialState);
          const finalKeywords = extractKeywords(finalState);
          const initialSelected = extractSelectedKeywords(initialState);
          const finalSelected = extractSelectedKeywords(finalState);

          const keywordChanges = computeKeywordChanges(
            initialKeywords,
            finalKeywords
          );
          const selectionChanges = computeSelectionChanges(
            initialSelected,
            finalSelected,
            finalKeywords
          );

          for (const change of keywordChanges) {
            if (change.type === "updated" && change.updatedFields?.word) {
              const dotProduct = await calculateSimilarity(
                change.updatedFields.word.from,
                change.updatedFields.word.to
              );
              const normPrev = await getNorm(change.updatedFields.word.from);
              const normCurr = await getNorm(change.updatedFields.word.to);
              change.similarity =
                normPrev * normCurr > 0
                  ? dotProduct / (normPrev * normCurr)
                  : 0;
            }
          }

          const stepwiseKeywordChanges: {
            step: number;
            changes: KeywordChange[];
          }[] = [];
          const stepwiseSelectionChanges: {
            step: number;
            changes: SelectionChange[];
          }[] = [];
          let prevKeywords = initialKeywords;
          let prevSelected = initialSelected;

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
            selectionChanges,
            stepwiseKeywordChanges,
            stepwiseSelectionChanges,
          };
        })
      );

      setSequenceDiffs(computedDiffs);
    };

    if (sequences.length > 0) {
      computeDiffs();
    } else {
      setSequenceDiffs([]);
    }
  }, [sequences, calculateSimilarity]);

  if (isLoading)
    return <p className="p-4 text-gray-600">Loading sequences...</p>;
  if (!isDatabaseLoaded)
    return <p className="p-4 text-gray-600">Please select a database first.</p>;

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">
        Keywords Diff Viewer
      </h1>
      <p className="mb-4 text-gray-600">
        Total number of regenerations:{" "}
        {sequenceDiffs.filter((seq) => seq.isRegeneration).length}
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

            {seqDiff.keywordChanges.length > 0 ? (
              <div className="mb-6">
                <h3 className="text-lg font-medium mb-2 text-gray-700">
                  Keyword Changes
                </h3>
                <table className="table-auto w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="p-2 border">Type</th>
                      <th className="p-2 border">Keyword ID</th>
                      <th className="p-2 border">Word</th>
                      <th className="p-2 border">Updated Fields</th>
                      <th className="p-2 border">Similarity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {seqDiff.keywordChanges.map((change, index) => (
                      <tr
                        key={change.keywordId || `keyword-change-${index}`}
                        className="hover:bg-gray-50"
                      >
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
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mb-4 text-gray-600">No keyword changes.</p>
            )}

            {seqDiff.selectionChanges.length > 0 ? (
              <div className="mb-6">
                <h3 className="text-lg font-medium mb-2 text-gray-700">
                  Selection Changes
                </h3>
                <table className="table-auto w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="p-2 border">Type</th>
                      <th className="p-2 border">Keyword ID</th>
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
              <p className="mb-4 text-gray-600">No selection changes.</p>
            )}

            <h3 className="text-lg font-medium mb-2 text-gray-700">
              Stepwise Changes
            </h3>
            {seqDiff.stepwiseKeywordChanges.length > 0 ||
            seqDiff.stepwiseSelectionChanges.length > 0 ? (
              <>
                {seqDiff.stepwiseKeywordChanges.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-md font-medium text-gray-600">
                      Keyword Changes
                    </h4>
                    {seqDiff.stepwiseKeywordChanges.map((step) => (
                      <div key={step.step} className="mb-4">
                        <h5 className="text-sm font-medium text-gray-500">
                          Step {step.step}
                        </h5>
                        <table className="table-auto w-full border-collapse border border-gray-300">
                          <thead>
                            <tr className="bg-gray-100">
                              <th className="p-2 border">Type</th>
                              <th className="p-2 border">Keyword ID</th>
                              <th className="p-2 border">Word</th>
                              <th className="p-2 border">Updated Fields</th>
                              <th className="p-2 border">Similarity</th>
                            </tr>
                          </thead>
                          <tbody>
                            {step.changes.map((change, index) => (
                              <tr
                                key={
                                  change.keywordId ||
                                  `step-${step.step}-keyword-${index}`
                                }
                                className="hover:bg-gray-50"
                              >
                                <td className="p-2 border">{change.type}</td>
                                <td className="p-2 border">
                                  {change.keywordId}
                                </td>
                                <td className="p-2 border">
                                  {change.word || "-"}
                                </td>
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
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                )}
                {seqDiff.stepwiseSelectionChanges.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-md font-medium text-gray-600">
                      Selection Changes
                    </h4>
                    {seqDiff.stepwiseSelectionChanges.map((step) => (
                      <div key={step.step} className="mb-4">
                        <h5 className="text-sm font-medium text-gray-500">
                          Step {step.step}
                        </h5>
                        <table className="table-auto w-full border-collapse border border-gray-300">
                          <thead>
                            <tr className="bg-gray-100">
                              <th className="p-2 border">Type</th>
                              <th className="p-2 border">Keyword ID</th>
                              <th className="p-2 border">Word</th>
                            </tr>
                          </thead>
                          <tbody>
                            {step.changes.map((change, index) => (
                              <tr
                                key={
                                  change.keywordId ||
                                  `step-${step.step}-selection-${index}`
                                }
                                className="hover:bg-gray-50"
                              >
                                <td className="p-2 border">{change.type}</td>
                                <td className="p-2 border">
                                  {change.keywordId}
                                </td>
                                <td className="p-2 border">{change.word}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                )}
              </>
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

export default KeywordsDiffViewer;

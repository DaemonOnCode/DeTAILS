import React, { useState, useEffect } from "react";
import { useDatabase } from "./context";

/** Type Definitions */
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
  updatedFields?: Partial<Keyword>;
}

interface SelectionChange {
  type: "selected" | "deselected";
  keywordId: string;
  word: string;
}

type Change = KeywordChange | SelectionChange;

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

/** Helper Functions */
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
  const currentState =
    typeof state === "string"
      ? JSON.parse(state).current_state
      : state.current_state;
  if (state.context && state.context.keywords) {
    keywordArray = state.context.keywords;
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
  const selectedArray =
    typeof state === "string"
      ? JSON.parse(state).selected_keywords
      : state.selected_keywords;
  if (Array.isArray(selectedArray)) {
    selectedArray.forEach((id: string) => selected.add(id));
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
      const updatedFields: Partial<Keyword> = {};
      if (prevKw.word !== currKw.word) updatedFields.word = currKw.word;
      if (prevKw.description !== currKw.description)
        updatedFields.description = currKw.description;
      if (
        JSON.stringify(prevKw.inclusion_criteria) !==
        JSON.stringify(currKw.inclusion_criteria)
      )
        updatedFields.inclusion_criteria = currKw.inclusion_criteria;
      if (
        JSON.stringify(prevKw.exclusion_criteria) !==
        JSON.stringify(currKw.exclusion_criteria)
      )
        updatedFields.exclusion_criteria = currKw.exclusion_criteria;
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

/** KeywordsDiffViewer Component */
const KeywordsDiffViewer: React.FC = () => {
  const { isDatabaseLoaded, executeQuery } = useDatabase();
  const [sequences, setSequences] = useState<DatabaseRow[][]>([]);
  const [diffs, setDiffs] = useState<SequenceDiff[]>([]);
  const [totalInsertionsBetweenInitials, setTotalInsertionsBetweenInitials] =
    useState(0);
  const [totalDeletionsBetweenInitials, setTotalDeletionsBetweenInitials] =
    useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchEntries = async () => {
      setIsLoading(true);
      try {
        const query = `
          SELECT * FROM state_dumps
          WHERE json_extract(context, '$.function') IN ('keyword_cloud_table', 'setSelectedKeywords', 'setKeywords')
          ORDER BY created_at ASC
        `;
        const result = await executeQuery(query, []);
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
    const computeDiffsAndTotals = async () => {
      const computedDiffs = sequences.map((sequence, seqIndex) => {
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
          initialTimestamp: new Date(initialEntry.created_at).toLocaleString(),
          finalTimestamp: new Date(
            sequence[sequence.length - 1].created_at
          ).toLocaleString(),
          isRegeneration,
          keywordChanges,
          selectionChanges,
          stepwiseKeywordChanges,
          stepwiseSelectionChanges,
        };
      });

      setDiffs(computedDiffs);

      const initialRuns = computedDiffs.filter((diff) => !diff.isRegeneration);
      if (initialRuns.length >= 2) {
        const firstInitialSequence = sequences[initialRuns[0].sequenceId - 1];
        const secondInitialSequence = sequences[initialRuns[1].sequenceId - 1];
        const firstInitialState = JSON.parse(firstInitialSequence[0].state);
        const secondInitialState = JSON.parse(secondInitialSequence[0].state);
        const firstKeywords = extractKeywords(firstInitialState);
        const secondKeywords = extractKeywords(secondInitialState);
        const changesBetweenInitials = computeKeywordChanges(
          firstKeywords,
          secondKeywords
        );
        const insertions = changesBetweenInitials.filter(
          (change) => change.type === "inserted"
        ).length;
        const deletions = changesBetweenInitials.filter(
          (change) => change.type === "deleted"
        ).length;
        setTotalInsertionsBetweenInitials(insertions);
        setTotalDeletionsBetweenInitials(deletions);
      } else {
        setTotalInsertionsBetweenInitials(0);
        setTotalDeletionsBetweenInitials(0);
      }
    };

    if (sequences.length > 0) {
      computeDiffsAndTotals();
    } else {
      setDiffs([]);
      setTotalInsertionsBetweenInitials(0);
      setTotalDeletionsBetweenInitials(0);
    }
  }, [sequences]);

  if (isLoading)
    return <p className="p-4 text-gray-600">Loading sequences...</p>;
  if (!isDatabaseLoaded)
    return <p className="p-4 text-gray-600">Please select a database first.</p>;

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">
        Keywords Diff Viewer
      </h1>
      <div className="mb-4 text-gray-600">
        <p>
          <strong>Total number of regenerations:</strong>{" "}
          {diffs.filter((seq) => seq.isRegeneration).length}
        </p>
        <p>
          <strong>Total insertions between two initial runs:</strong>{" "}
          {totalInsertionsBetweenInitials}
        </p>
        <p>
          <strong>Total deletions between two initial runs:</strong>{" "}
          {totalDeletionsBetweenInitials}
        </p>
      </div>
      {diffs.length === 0 ? (
        <p className="text-gray-600">No sequences found.</p>
      ) : (
        diffs.map((seqDiff) => (
          <div key={seqDiff.sequenceId} className="mb-8">
            <h2 className="text-xl font-semibold mb-2 text-gray-700">
              Sequence {seqDiff.sequenceId}: {seqDiff.initialTimestamp} to{" "}
              {seqDiff.finalTimestamp} (
              {seqDiff.isRegeneration ? "Regeneration" : "Initial Generation"})
            </h2>
            <h3 className="text-lg font-medium mb-2 text-gray-700">
              Initial vs Final Changes
            </h3>
            {seqDiff.keywordChanges.length > 0 ||
            seqDiff.selectionChanges.length > 0 ? (
              <table className="table-auto w-full border-collapse border border-gray-300 mb-4">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-2 border">Type</th>
                    <th className="p-2 border">Keyword ID</th>
                    <th className="p-2 border">Word</th>
                    <th className="p-2 border">Updated Fields</th>
                  </tr>
                </thead>
                <tbody>
                  {[...seqDiff.keywordChanges, ...seqDiff.selectionChanges].map(
                    (change, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="p-2 border">{change.type}</td>
                        <td className="p-2 border">{change.keywordId}</td>
                        <td className="p-2 border">{change.word || "-"}</td>
                        <td className="p-2 border">
                          {"updatedFields" in change && change.updatedFields
                            ? JSON.stringify(change.updatedFields)
                            : "-"}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            ) : (
              <p className="mb-4 text-gray-600">
                No changes between initial and final states.
              </p>
            )}

            <h3 className="text-lg font-medium mb-2 text-gray-700">
              Stepwise Changes
            </h3>
            {seqDiff.stepwiseKeywordChanges.length > 0 ||
            seqDiff.stepwiseSelectionChanges.length > 0 ? (
              [
                ...seqDiff.stepwiseKeywordChanges,
                ...seqDiff.stepwiseSelectionChanges,
              ].map((step) => (
                <div key={step.step} className="mb-4">
                  <h4 className="text-md font-medium text-gray-600">
                    Step {step.step}
                  </h4>
                  <table className="table-auto w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="p-2 border">Type</th>
                        <th className="p-2 border">Keyword ID</th>
                        <th className="p-2 border">Word</th>
                        <th className="p-2 border">Updated Fields</th>
                      </tr>
                    </thead>
                    <tbody>
                      {step.changes.map((change, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="p-2 border">{change.type}</td>
                          <td className="p-2 border">{change.keywordId}</td>
                          <td className="p-2 border">{change.word || "-"}</td>
                          <td className="p-2 border">
                            {"updatedFields" in change && change.updatedFields
                              ? JSON.stringify(change.updatedFields)
                              : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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

export default KeywordsDiffViewer;

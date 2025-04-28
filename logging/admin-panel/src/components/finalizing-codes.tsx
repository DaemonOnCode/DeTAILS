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

interface GroupChange {
  type: "group_name_changed";
  groupId: string;
  oldName: string;
  newName: string;
  similarity: number;
}

interface GroupDeletion {
  type: "group_deleted";
  groupId: string;
  name: string;
}

interface GroupInsertion {
  type: "group_inserted";
  groupId: string;
  name: string;
}

interface CodeMovement {
  type: "code_moved";
  code: string;
  fromGroupId: string | null;
  fromGroupName: string | null;
  toGroupId: string | null;
  toGroupName: string | null;
}

type Change = GroupChange | GroupDeletion | GroupInsertion | CodeMovement;

interface SequenceDiff {
  sequenceId: number;
  initialTimestamp: string;
  finalTimestamp: string;
  isRegeneration: boolean;
  changes: Change[];
  stepwiseChanges: { step: number; changes: Change[] }[];
  accuracy: number;
  macro_precision: number;
  macro_recall: number;
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
    if (context.function === "code_grouping") {
      if (currentSequence.length > 0) sequences.push(currentSequence);
      currentSequence = [entry];
    } else if (
      context.function === "dispatchGroupedCodes" &&
      currentSequence.length > 0
    ) {
      currentSequence.push(entry);
    }
  }
  if (currentSequence.length > 0) sequences.push(currentSequence);
  return sequences;
};

const extractGroupsAndMappings = (
  state: any,
  stateType: "generation" | "dispatch"
): { groups: Map<string, string>; codeToGroup: Map<string, string | null> } => {
  const groups = new Map<string, string>();
  const codeToGroup = new Map<string, string | null>();

  if (stateType === "generation") {
    if (state.higher_level_codes && Array.isArray(state.higher_level_codes)) {
      state.higher_level_codes.forEach((hlc: any) => {
        groups.set(hlc.id, hlc.name);
        hlc.codes.forEach((code: string) => codeToGroup.set(code, hlc.id));
      });
    }
    if (state.unplaced_codes && Array.isArray(state.unplaced_codes)) {
      state.unplaced_codes.forEach((code: string) =>
        codeToGroup.set(code, null)
      );
    }
  } else if (stateType === "dispatch") {
    if (state.current_state && Array.isArray(state.current_state)) {
      const groupSet = new Map<string, string>();
      state.current_state.forEach((item: any) => {
        if (item.code) {
          codeToGroup.set(item.code, item.higher_level_code_id);
          if (
            item.higher_level_code_id &&
            !groupSet.has(item.higher_level_code_id)
          ) {
            groupSet.set(item.higher_level_code_id, item.higher_level_code);
          }
        }
      });
      groupSet.forEach((name, id) => groups.set(id, name));
    }
  }

  return { groups, codeToGroup };
};

const renderChangeDetails = (change: Change): string => {
  switch (change.type) {
    case "group_name_changed":
      return `Group ID: ${change.groupId}, Old Name: ${
        change.oldName
      }, New Name: ${change.newName}, Similarity: ${change.similarity.toFixed(
        3
      )}`;
    case "group_deleted":
      return `Group ID: ${change.groupId}, Name: ${change.name}`;
    case "group_inserted":
      return `Group ID: ${change.groupId}, Name: ${change.name}`;
    case "code_moved":
      const from = change.fromGroupId
        ? `${change.fromGroupName} (ID: ${change.fromGroupId})`
        : "Unplaced";
      const to = change.toGroupId
        ? `${change.toGroupName} (ID: ${change.toGroupId})`
        : "Unplaced";
      return `Code: ${change.code}, From: ${from}, To: ${to}`;
    default:
      return "";
  }
};

const CodesDiffViewer: React.FC = () => {
  const {
    isDatabaseLoaded,
    executeQuery,
    calculateSimilarity,
    selectedWorkspaceId,
  } = useDatabase();
  const [sequences, setSequences] = useState<DatabaseRow[][]>([]);
  const [sequenceDiffs, setSequenceDiffs] = useState<SequenceDiff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const similarityCache = useRef(new Map<string, number>());

  const getGroupSimilarity = async (
    groupA: string,
    groupB: string
  ): Promise<number> => {
    if (groupA === groupB) return 1.0;
    const key = [groupA, groupB].sort().join("-");
    if (similarityCache.current.has(key)) {
      return similarityCache.current.get(key)!;
    }
    const similarity = await calculateSimilarity(groupA, groupB);
    similarityCache.current.set(key, similarity);
    return similarity;
  };

  const computeChanges = async (
    prevGroups: Map<string, string>,
    prevCodeToGroup: Map<string, string | null>,
    currGroups: Map<string, string>,
    currCodeToGroup: Map<string, string | null>
  ): Promise<Change[]> => {
    const changes: Change[] = [];

    for (const [groupId, prevName] of prevGroups) {
      if (currGroups.has(groupId)) {
        const currName = currGroups.get(groupId)!;
        if (prevName !== currName) {
          const similarity = await getGroupSimilarity(prevName, currName);
          changes.push({
            type: "group_name_changed",
            groupId,
            oldName: prevName,
            newName: currName,
            similarity,
          });
        }
      } else {
        changes.push({ type: "group_deleted", groupId, name: prevName });
      }
    }

    for (const [groupId, currName] of currGroups) {
      if (!prevGroups.has(groupId)) {
        changes.push({ type: "group_inserted", groupId, name: currName });
      }
    }

    const allCodes = new Set([
      ...prevCodeToGroup.keys(),
      ...currCodeToGroup.keys(),
    ]);
    for (const code of allCodes) {
      const prevGroupId = prevCodeToGroup.get(code) || null;
      const currGroupId = currCodeToGroup.get(code) || null;
      if (prevGroupId !== currGroupId) {
        changes.push({
          type: "code_moved",
          code,
          fromGroupId: prevGroupId,
          fromGroupName: prevGroupId ? prevGroups.get(prevGroupId)! : null,
          toGroupId: currGroupId,
          toGroupName: currGroupId ? currGroups.get(currGroupId)! : null,
        });
      }
    }

    return changes;
  };

  const computeMetrics = async (
    initialGroups: Map<string, string>,
    initialCodeToGroup: Map<string, string | null>,
    finalGroups: Map<string, string>,
    finalCodeToGroup: Map<string, string | null>
  ): Promise<{
    accuracy: number;
    macro_precision: number;
    macro_recall: number;
  }> => {
    const allCodes = new Set([
      ...initialCodeToGroup.keys(),
      ...finalCodeToGroup.keys(),
    ]);
    let TP = 0;
    let FP = 0;
    let FN = 0;

    for (const code of allCodes) {
      const initialGroupId = initialCodeToGroup.get(code) || null;
      const finalGroupId = finalCodeToGroup.get(code) || null;

      if (initialGroupId === finalGroupId) {
        if (initialGroupId !== null) {
          const initialGroupName = initialGroups.get(initialGroupId)!;
          const finalGroupName = finalGroups.get(finalGroupId ?? "")!;
          const similarity = await getGroupSimilarity(
            initialGroupName,
            finalGroupName
          );
          TP += similarity;
          FN += 1 - similarity;
        } else {
          TP += 1; // Both unplaced
        }
      } else {
        FP += 1; // Code moved to a different group or inserted
        FN += 1; // Code moved from a group or deleted
      }
    }

    const accuracy = allCodes.size > 0 ? TP / allCodes.size : 0;
    const macro_precision = TP + FP > 0 ? TP / (TP + FP) : 0;
    const macro_recall = TP + FN > 0 ? TP / (TP + FN) : 0;

    return { accuracy, macro_precision, macro_recall };
  };

  useEffect(() => {
    const fetchEntries = async () => {
      setIsLoading(true);
      try {
        const query = `
          SELECT * FROM state_dumps
          WHERE json_extract(context, '$.function') IN ('code_grouping', 'dispatchGroupedCodes')
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

          const initialExtract = extractGroupsAndMappings(
            initialState,
            "generation"
          );
          const finalExtract =
            sequence.length > 1
              ? extractGroupsAndMappings(finalState, "dispatch")
              : initialExtract;

          const changes = await computeChanges(
            initialExtract.groups,
            initialExtract.codeToGroup,
            finalExtract.groups,
            finalExtract.codeToGroup
          );

          const { accuracy, macro_precision, macro_recall } =
            await computeMetrics(
              initialExtract.groups,
              initialExtract.codeToGroup,
              finalExtract.groups,
              finalExtract.codeToGroup
            );

          const stepwiseChanges: { step: number; changes: Change[] }[] = [];
          for (let i = 0; i < sequence.length - 1; i++) {
            const prevExtract =
              i === 0
                ? extractGroupsAndMappings(
                    JSON.parse(sequence[i].state),
                    "generation"
                  )
                : extractGroupsAndMappings(
                    JSON.parse(sequence[i].state),
                    "dispatch"
                  );
            const nextExtract = extractGroupsAndMappings(
              JSON.parse(sequence[i + 1].state),
              "dispatch"
            );
            const stepChanges = await computeChanges(
              prevExtract.groups,
              prevExtract.codeToGroup,
              nextExtract.groups,
              nextExtract.codeToGroup
            );
            if (stepChanges.length > 0)
              stepwiseChanges.push({ step: i + 1, changes: stepChanges });
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
            macro_precision,
            macro_recall,
          };
        })
      );
      setSequenceDiffs(diffs);
    };

    if (sequences.length > 0) {
      computeDiffs();
    }
  }, [sequences]);

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
        Codes Diff Viewer
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
                <strong>Macro Precision:</strong>{" "}
                {seqDiff.macro_precision.toFixed(3)}
              </p>
              <p>
                <strong>Macro Recall:</strong> {seqDiff.macro_recall.toFixed(3)}
              </p>
            </div>

            <h3 className="text-lg font-medium mb-2 text-gray-700">
              Initial vs Final Changes
            </h3>
            {seqDiff.changes.length > 0 ? (
              <table className="table-auto w-full border-collapse border border-gray-300 mb-4">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-2 border">Type</th>
                    <th className="p-2 border">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {seqDiff.changes.map((change, index) => (
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
              <p className="mb-4 text-gray-600">
                No changes between initial and final states.
              </p>
            )}

            <h3 className="text-lg font-medium mb-2 text-gray-700">
              Stepwise Changes
            </h3>
            {seqDiff.stepwiseChanges.length > 0 ? (
              seqDiff.stepwiseChanges.map((step) => (
                <div key={step.step} className="mb-4">
                  <h4 className="text-md font-medium text-gray-600">
                    Step {step.step}
                  </h4>
                  <table className="table-auto w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="p-2 border">Type</th>
                        <th className="p-2 border">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {step.changes.map((change, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="p-2 border">{change.type}</td>
                          <td className="p-2 border">
                            {renderChangeDetails(change)}
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

export default CodesDiffViewer;

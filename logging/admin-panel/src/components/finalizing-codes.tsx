import React, { useState, useEffect, useRef } from "react";
import { useDatabase } from "./context";
import { DatabaseRow, Context } from "../utils/types";

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

interface GroupMetric {
  groupId: string;
  initialName: string;
  finalName: string | "Deleted" | "Inserted";
  initialCodeCount: number;
  finalCodeCount: number;
  precision: number;
  recall: number;
  similarity?: number;
  jaccard: number;
  effectiveNameChange?: boolean;
}

interface ConfusionMatrixEntry {
  initialGroupId: string;
  finalGroupId: string;
  count: number;
}

interface SequenceDiff {
  sequenceId: number;
  initialTimestamp: string;
  finalTimestamp: string;
  isRegeneration: boolean;
  changes: Change[];
  stepwiseChanges: { step: number; changes: Change[] }[];
  precision: number;
  recall: number;
  macroPrecision: number;
  macroRecall: number;
  groupMetrics: GroupMetric[];
  confusionMatrix: ConfusionMatrixEntry[];
  initialGroupsObj: { [id: string]: string };
  finalGroupsObj: { [id: string]: string };
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

const computeMetrics = async (
  initialGroups: Map<string, string>,
  initialCodeToGroup: Map<string, string | null>,
  finalGroups: Map<string, string>,
  finalCodeToGroup: Map<string, string | null>,
  calculateSimilarity: (a: string, b: string) => Promise<number>
): Promise<{
  precision: number;
  recall: number;
  macroPrecision: number;
  macroRecall: number;
  groupMetrics: GroupMetric[];
  confusionMatrix: ConfusionMatrixEntry[];
}> => {
  console.log("Starting group metrics calculation");

  const initGroupToCodes = new Map<string, Set<string>>();
  const finalGroupToCodes = new Map<string, Set<string>>();
  const allCodes = new Set([
    ...initialCodeToGroup.keys(),
    ...finalCodeToGroup.keys(),
  ]);

  for (const [code, groupId] of initialCodeToGroup.entries()) {
    const group = groupId || "unplaced";
    if (!initGroupToCodes.has(group)) initGroupToCodes.set(group, new Set());
    initGroupToCodes.get(group)!.add(code);
  }
  for (const [code, groupId] of finalCodeToGroup.entries()) {
    const group = groupId || "unplaced";
    if (!finalGroupToCodes.has(group)) finalGroupToCodes.set(group, new Set());
    finalGroupToCodes.get(group)!.add(code);
  }

  const confusionMatrix: ConfusionMatrixEntry[] = [];
  for (const code of allCodes) {
    const initGroup = initialCodeToGroup.get(code) || "unplaced";
    const finalGroup = finalCodeToGroup.get(code) || "unplaced";
    const entry = confusionMatrix.find(
      (e) => e.initialGroupId === initGroup && e.finalGroupId === finalGroup
    );
    if (entry) {
      entry.count++;
    } else {
      confusionMatrix.push({
        initialGroupId: initGroup,
        finalGroupId: finalGroup,
        count: 1,
      });
    }
  }
  console.log("Confusion Matrix:", confusionMatrix);

  const groupMapping = new Map<string, string>();
  const mappedFinalGroups = new Set<string>();
  for (const groupId of [...initialGroups.keys(), "unplaced"]) {
    if (finalGroups.has(groupId) || groupId === "unplaced") {
      groupMapping.set(groupId, groupId);
      mappedFinalGroups.add(groupId);
      console.log(
        `Mapped initial group ${groupId} to final group ${groupId} by ID`
      );
    }
  }

  const remainingInitialGroups = Array.from(initialGroups.keys()).filter(
    (groupId) => !groupMapping.has(groupId)
  );
  for (const initGroupId of remainingInitialGroups) {
    const initCodes = initGroupToCodes.get(initGroupId) || new Set();
    let maxJaccard = 0;
    let bestMatch: string | null = null;
    for (const [finalGroupId, finalCodes] of finalGroupToCodes) {
      if (mappedFinalGroups.has(finalGroupId)) continue;
      const intersection = new Set(
        [...initCodes].filter((code) => finalCodes.has(code))
      );
      const union = new Set([...initCodes, ...finalCodes]);
      const jaccard = intersection.size / union.size;
      if (jaccard > maxJaccard) {
        maxJaccard = jaccard;
        bestMatch = finalGroupId;
      }
    }
    if (maxJaccard >= 0.5 && bestMatch) {
      groupMapping.set(initGroupId, bestMatch);
      mappedFinalGroups.add(bestMatch);
      console.log(
        `Mapped initial group ${initGroupId} to final group ${bestMatch} by Jaccard similarity: ${maxJaccard}`
      );
    } else {
      console.log(
        `No suitable mapping found for initial group ${initGroupId} (deleted)`
      );
    }
  }

  let totalSupport = 0;
  let weightedPrecSum = 0;
  let weightedRecSum = 0;
  const groupMetrics: GroupMetric[] = [];
  let macroPrecisionSum = 0;
  let macroRecallSum = 0;
  let macroCount = 0;

  for (const [groupId, initialName] of [
    ...initialGroups,
    ["unplaced", "Unplaced"],
  ]) {
    const initCodes = initGroupToCodes.get(groupId) || new Set();
    const mappedGroupId = groupMapping.get(groupId);
    const finalCodes: Set<string> = mappedGroupId
      ? finalGroupToCodes.get(mappedGroupId) || new Set()
      : new Set();
    const support = initCodes.size;
    totalSupport += support;

    const TP = [...initCodes].filter((code) => finalCodes.has(code)).length;
    const FP = [...initCodes].filter((code) => !finalCodes.has(code)).length;
    const FN = [...finalCodes].filter((code) => !initCodes.has(code)).length;

    const jaccard =
      initCodes.size + finalCodes.size - TP > 0
        ? TP / (initCodes.size + finalCodes.size - TP)
        : 0;

    const precision = TP + FP > 0 ? TP / (TP + FP) : 0;
    const recall = TP + FN > 0 ? TP / (TP + FN) : 0;

    weightedPrecSum += precision * support;
    weightedRecSum += recall * support;

    const finalName = mappedGroupId
      ? finalGroups.get(mappedGroupId) || "Unplaced"
      : "Unplaced";
    const similarity =
      finalName !== "Unplaced" && initialName !== finalName
        ? await calculateSimilarity(initialName, finalName)
        : undefined;
    const effectiveNameChange =
      !!mappedGroupId &&
      initialName !== finalName &&
      jaccard >= 0.8 &&
      (similarity || 1.0) < 0.5;

    groupMetrics.push({
      groupId,
      initialName,
      finalName,
      initialCodeCount: initCodes.size,
      finalCodeCount: finalCodes.size,
      precision,
      recall,
      similarity,
      jaccard,
      effectiveNameChange,
    });

    if (initCodes.size > 0 || finalCodes.size > 0) {
      macroPrecisionSum += precision;
      macroRecallSum += recall;
      macroCount++;
    }

    console.log(
      `Group ${groupId} metrics: TP=${TP}, FP=${FP}, FN=${FN}, Precision=${precision}, Recall=${recall}, Initial Code Count=${initCodes.size}, Final Code Count=${finalCodes.size}`
    );
  }

  for (const [groupId, finalName] of finalGroups) {
    if (!mappedFinalGroups.has(groupId)) {
      const finalCodes = finalGroupToCodes.get(groupId) || new Set();
      groupMetrics.push({
        groupId,
        initialName: "Inserted",
        finalName,
        initialCodeCount: 0,
        finalCodeCount: finalCodes.size,
        precision: 0,
        recall: 0,
        jaccard: 0,
      });
      if (finalCodes.size > 0) {
        macroCount++;
      }
      console.log(
        `Inserted group ${groupId} with name ${finalName}, Initial Code Count=0, Final Code Count=${finalCodes.size}`
      );
    }
  }

  const weightedPrecision =
    totalSupport > 0 ? weightedPrecSum / totalSupport : 0;
  const weightedRecall = totalSupport > 0 ? weightedRecSum / totalSupport : 0;

  const macroPrecision = macroCount > 0 ? macroPrecisionSum / macroCount : 0;
  const macroRecall = macroCount > 0 ? macroRecallSum / macroCount : 0;

  console.log(
    `Weighted Precision: ${weightedPrecision}, Weighted Recall: ${weightedRecall}, Macro Precision: ${macroPrecision}, Macro Recall: ${macroRecall}`
  );
  console.log("Finished group metrics calculation");

  return {
    precision: weightedPrecision,
    recall: weightedRecall,
    macroPrecision,
    macroRecall,
    groupMetrics,
    confusionMatrix,
  };
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

const ReviewingCodesDiffViewer: React.FC = () => {
  const {
    isDatabaseLoaded,
    executeQuery,
    calculateSimilarity,
    selectedWorkspaceId,
  } = useDatabase();
  const [sequences, setSequences] = useState<DatabaseRow[][]>([]);
  const [sequenceDiffs, setSequenceDiffs] = useState<SequenceDiff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openSteps, setOpenSteps] = useState<{ [key: string]: boolean }>({});
  const similarityCache = useRef(new Map<string, number>());

  const getGroupSimilarity = async (
    groupA: string,
    groupB: string
  ): Promise<number> => {
    if (groupA === groupB) return 1.0;
    const key = [groupA, groupB].sort().join("-");
    if (similarityCache.current.has(key))
      return similarityCache.current.get(key)!;
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

          const metrics = await computeMetrics(
            initialExtract.groups,
            initialExtract.codeToGroup,
            finalExtract.groups,
            finalExtract.codeToGroup,
            calculateSimilarity
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
            precision: metrics.precision,
            recall: metrics.recall,
            macroPrecision: metrics.macroPrecision,
            macroRecall: metrics.macroRecall,
            groupMetrics: metrics.groupMetrics,
            confusionMatrix: metrics.confusionMatrix,
            initialGroupsObj: Object.fromEntries(initialExtract.groups),
            finalGroupsObj: Object.fromEntries(finalExtract.groups),
          };
        })
      );
      setSequenceDiffs(diffs);
    };

    if (sequences.length > 0) computeDiffs();
  }, [sequences, calculateSimilarity]);

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
        Finalizing Codes Results
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
                <strong>Weighted Precision:</strong> {seqDiff.precision}
              </p>
              <p>
                <strong>Weighted Recall:</strong> {seqDiff.recall}
              </p>
              <p>
                <strong>Weighted F1:</strong>{" "}
                {(2 * (seqDiff.precision * seqDiff.recall)) /
                  (seqDiff.precision + seqDiff.recall)}
              </p>
              <p>
                <strong>Macro Precision:</strong> {seqDiff.macroPrecision}
              </p>
              <p>
                <strong>Macro Recall:</strong> {seqDiff.macroRecall}
              </p>
              <p>
                <strong>Macro F1:</strong>{" "}
                {(2 * (seqDiff.macroPrecision * seqDiff.macroRecall)) /
                  (seqDiff.macroPrecision + seqDiff.macroRecall)}
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
              Group Metrics
            </h3>
            {seqDiff.groupMetrics.length > 0 ? (
              <table className="table-auto w-full border-collapse border border-gray-300 mb-4">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-2 border">Group ID</th>
                    <th className="p-2 border">Initial Name</th>
                    <th className="p-2 border">Final Name</th>
                    <th className="p-2 border">Initial Code Count</th>
                    <th className="p-2 border">Final Code Count</th>
                    <th className="p-2 border">Similarity</th>
                    <th className="p-2 border">Precision</th>
                    <th className="p-2 border">Recall</th>
                    <th className="p-2 border">Jaccard</th>
                    <th className="p-2 border">Effective Name Change</th>
                  </tr>
                </thead>
                <tbody>
                  {seqDiff.groupMetrics.map((metric, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="p-2 border">{metric.groupId}</td>
                      <td className="p-2 border">
                        {metric.initialName === "Deleted" ||
                        metric.initialName === "Inserted"
                          ? "-"
                          : metric.initialName}
                      </td>
                      <td className="p-2 border">
                        {metric.finalName === "Deleted" ||
                        metric.finalName === "Inserted"
                          ? "-"
                          : metric.finalName}
                      </td>
                      <td className="p-2 border">{metric.initialCodeCount}</td>
                      <td className="p-2 border">{metric.finalCodeCount}</td>
                      <td className="p-2 border">
                        {metric.similarity !== undefined
                          ? metric.similarity
                          : "N/A"}
                      </td>
                      <td className="p-2 border">{metric.precision}</td>
                      <td className="p-2 border">{metric.recall}</td>
                      <td className="p-2 border">{metric.jaccard}</td>
                      <td className="p-2 border">
                        {metric.effectiveNameChange ? "Yes" : "No"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="mb-4 text-gray-600">No group metrics available.</p>
            )}

            <h3 className="text-lg font-medium mb-2 text-gray-700">
              Confusion Matrix
            </h3>
            {seqDiff.confusionMatrix.length > 0 ? (
              <table className="table-auto w-full border-collapse border border-gray-300 mb-4">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-2 border">Initial Group</th>
                    <th className="p-2 border">Final Group</th>
                    <th className="p-2 border">Code Count</th>
                  </tr>
                </thead>
                <tbody>
                  {seqDiff.confusionMatrix.map((entry, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="p-2 border">
                        {entry.initialGroupId === "unplaced"
                          ? "unplaced"
                          : seqDiff.initialGroupsObj[entry.initialGroupId] ||
                            "unknown"}
                      </td>
                      <td className="p-2 border">
                        {entry.finalGroupId === "unplaced"
                          ? "unplaced"
                          : seqDiff.finalGroupsObj[entry.finalGroupId] ||
                            "unknown"}
                      </td>
                      <td className="p-2 border">{entry.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="mb-4 text-gray-600">
                No confusion matrix data available.
              </p>
            )}

            <h3 className="text-lg font-medium mb-2 text-gray-700">
              Stepwise Changes
            </h3>
            {seqDiff.stepwiseChanges.length > 0 ? (
              seqDiff.stepwiseChanges.map((step) => (
                <div key={step.step} className="mb-4">
                  <h4
                    className="text-md font-medium text-gray-600 cursor-pointer"
                    onClick={() => toggleStep(seqDiff.sequenceId, step.step)}
                  >
                    Step {step.step}{" "}
                    {openSteps[`${seqDiff.sequenceId}-${step.step}`]
                      ? "▲"
                      : "▼"}
                  </h4>
                  {openSteps[`${seqDiff.sequenceId}-${step.step}`] && (
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

export default ReviewingCodesDiffViewer;

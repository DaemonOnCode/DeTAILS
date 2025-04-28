import React, { useState, useEffect, useRef } from "react";
import { useDatabase } from "./context";
import { DatabaseRow, Context } from "../utils/types";

interface ThemeChange {
  type: "theme_name_changed";
  themeId: string;
  oldName: string;
  newName: string;
  similarity: number;
}

interface ThemeDeletion {
  type: "theme_deleted";
  themeId: string;
  name: string;
}

interface ThemeInsertion {
  type: "theme_inserted";
  themeId: string;
  name: string;
}

interface CodeMovement {
  type: "code_moved";
  code: string;
  fromThemeId: string | null;
  fromThemeName: string | null;
  toThemeId: string | null;
  toThemeName: string | null;
}

type Change = ThemeChange | ThemeDeletion | ThemeInsertion | CodeMovement;

interface ThemeMetric {
  themeId: string;
  initialName: string;
  finalName: string | "Deleted";
  precision: number;
  recall: number;
  similarity?: number;
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
  themeMetrics: ThemeMetric[];
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
    if (context.function === "theme_generation") {
      if (currentSequence.length > 0) sequences.push(currentSequence);
      currentSequence = [entry];
    } else if (
      context.function === "dispatchThemes" &&
      currentSequence.length > 0
    ) {
      currentSequence.push(entry);
    }
  }
  if (currentSequence.length > 0) sequences.push(currentSequence);
  return sequences;
};

const extractThemesAndMappings = (
  state: any,
  stateType: "generation" | "dispatch"
): {
  themes: Map<string, string>;
  codeToTheme: Map<string, string | null>;
} => {
  const themes = new Map<string, string>();
  const codeToTheme = new Map<string, string | null>();

  if (stateType === "generation") {
    state.themes.forEach((theme: any) => {
      themes.set(theme.id, theme.theme);
      theme.codes.forEach((code: string) => codeToTheme.set(code, theme.id));
    });
    state.unplaced_codes.forEach((code: string) => codeToTheme.set(code, null));
  } else if (stateType === "dispatch") {
    const themeSet = new Set<string>();
    state.current_state.forEach((item: any) => {
      if (item.theme_id && !themeSet.has(item.theme_id)) {
        themes.set(item.theme_id, item.theme);
        themeSet.add(item.theme_id);
      }
      if (item.higher_level_code) {
        codeToTheme.set(item.higher_level_code, item.theme_id);
      }
    });
  }
  return { themes, codeToTheme };
};

const renderChangeDetails = (change: Change): string => {
  switch (change.type) {
    case "theme_name_changed":
      return `Theme ID: ${change.themeId}, Old Name: ${
        change.oldName
      }, New Name: ${change.newName}, Similarity: ${change.similarity.toFixed(
        3
      )}`;
    case "theme_deleted":
      return `Theme ID: ${change.themeId}, Name: ${change.name}`;
    case "theme_inserted":
      return `Theme ID: ${change.themeId}, Name: ${change.name}`;
    case "code_moved":
      const from = change.fromThemeId
        ? `${change.fromThemeName} (ID: ${change.fromThemeId})`
        : "Unplaced";
      const to = change.toThemeId
        ? `${change.toThemeName} (ID: ${change.toThemeId})`
        : "Unplaced";
      return `Code: ${change.code}, From: ${from}, To: ${to}`;
    default:
      return "";
  }
};

const ThemesDiffViewer: React.FC = () => {
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

  const getSimilarity = async (
    themeA: string,
    themeB: string
  ): Promise<number> => {
    const key = [themeA, themeB].sort().join("-");
    if (similarityCache.current.has(key)) {
      return similarityCache.current.get(key)!;
    }
    const sim = await calculateSimilarity(themeA, themeB);
    similarityCache.current.set(key, sim);
    return sim;
  };

  const getThemeSimilarity = async (
    themeA: string,
    themeB: string
  ): Promise<number> => {
    if (themeA === themeB) return 1.0;
    return await getSimilarity(themeA, themeB);
  };

  const computeChanges = async (
    prevThemes: Map<string, string>,
    prevCodeToTheme: Map<string, string | null>,
    currThemes: Map<string, string>,
    currCodeToTheme: Map<string, string | null>
  ): Promise<Change[]> => {
    const changes: Change[] = [];

    for (const [themeId, prevName] of prevThemes) {
      if (currThemes.has(themeId)) {
        const currName = currThemes.get(themeId)!;
        if (prevName !== currName) {
          const similarity = await getThemeSimilarity(prevName, currName);
          changes.push({
            type: "theme_name_changed",
            themeId,
            oldName: prevName,
            newName: currName,
            similarity,
          });
        }
      } else {
        changes.push({ type: "theme_deleted", themeId, name: prevName });
      }
    }

    for (const [themeId, currName] of currThemes) {
      if (!prevThemes.has(themeId)) {
        changes.push({ type: "theme_inserted", themeId, name: currName });
      }
    }

    const allCodes = new Set([
      ...prevCodeToTheme.keys(),
      ...currCodeToTheme.keys(),
    ]);
    for (const code of allCodes) {
      const prevThemeId = prevCodeToTheme.get(code) || null;
      const currThemeId = currCodeToTheme.get(code) || null;
      if (prevThemeId !== currThemeId) {
        changes.push({
          type: "code_moved",
          code,
          fromThemeId: prevThemeId,
          fromThemeName: prevThemeId ? prevThemes.get(prevThemeId)! : null,
          toThemeId: currThemeId,
          toThemeName: currThemeId ? currThemes.get(currThemeId)! : null,
        });
      }
    }

    return changes;
  };

  const computeMetrics = async (
    initialThemes: Map<string, string>,
    initialCodeToTheme: Map<string, string | null>,
    finalThemes: Map<string, string>,
    finalCodeToTheme: Map<string, string | null>
  ): Promise<{
    precision: number;
    recall: number;
    themeMetrics: ThemeMetric[];
  }> => {
    const initThemeToCodes = new Map<string, Set<string>>();
    const finalThemeToCodes = new Map<string, Set<string>>();

    for (const [code, themeId] of initialCodeToTheme.entries()) {
      if (themeId == null) continue;
      if (!initThemeToCodes.has(themeId)) {
        initThemeToCodes.set(themeId, new Set());
      }
      initThemeToCodes.get(themeId)!.add(code);
    }
    for (const [code, themeId] of finalCodeToTheme.entries()) {
      if (themeId == null) continue;
      if (!finalThemeToCodes.has(themeId)) {
        finalThemeToCodes.set(themeId, new Set());
      }
      finalThemeToCodes.get(themeId)!.add(code);
    }

    let totalSupport = 0;
    let weightedPrecSum = 0;
    let weightedRecSum = 0;
    const themeMetrics: ThemeMetric[] = [];

    for (const [themeId] of initialThemes.entries()) {
      const initCodes = initThemeToCodes.get(themeId) || new Set();
      const finalCodes = finalThemeToCodes.get(themeId) || new Set();
      const support = initCodes.size;
      totalSupport += support;

      let tp = 0;
      for (const code of initCodes) {
        if (finalCodes.has(code)) tp++;
      }
      const fn = support - tp;
      let fp = 0;
      for (const code of finalCodes) {
        if (!initCodes.has(code)) fp++;
      }

      const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
      const recall = tp + fn > 0 ? tp / (tp + fn) : 0;

      weightedPrecSum += precision * support;
      weightedRecSum += recall * support;

      const initialName = initialThemes.get(themeId)!;
      const finalName = finalThemes.has(themeId)
        ? finalThemes.get(themeId)!
        : "Deleted";

      let similarity: number | undefined;
      if (finalName !== "Deleted") {
        similarity = await getThemeSimilarity(initialName, finalName);
      }

      themeMetrics.push({
        themeId,
        initialName,
        finalName,
        precision,
        recall,
        similarity,
      });
    }

    const weightedPrecision =
      totalSupport > 0 ? weightedPrecSum / totalSupport : 0;
    const weightedRecall = totalSupport > 0 ? weightedRecSum / totalSupport : 0;

    return {
      precision: weightedPrecision,
      recall: weightedRecall,
      themeMetrics,
    };
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
          WHERE json_extract(context, '$.function') IN ('theme_generation', 'dispatchThemes')
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

          const initialExtract = extractThemesAndMappings(
            initialState,
            "generation"
          );
          const finalExtract =
            sequence.length > 1
              ? extractThemesAndMappings(finalState, "dispatch")
              : initialExtract;

          const changes = await computeChanges(
            initialExtract.themes,
            initialExtract.codeToTheme,
            finalExtract.themes,
            finalExtract.codeToTheme
          );

          const metrics = await computeMetrics(
            initialExtract.themes,
            initialExtract.codeToTheme,
            finalExtract.themes,
            finalExtract.codeToTheme
          );

          const stepwiseChanges: { step: number; changes: Change[] }[] = [];
          for (let i = 0; i < sequence.length - 1; i++) {
            const prevExtract =
              i === 0
                ? extractThemesAndMappings(
                    JSON.parse(sequence[i].state),
                    "generation"
                  )
                : extractThemesAndMappings(
                    JSON.parse(sequence[i].state),
                    "dispatch"
                  );
            const nextExtract = extractThemesAndMappings(
              JSON.parse(sequence[i + 1].state),
              "dispatch"
            );
            const stepChanges = await computeChanges(
              prevExtract.themes,
              prevExtract.codeToTheme,
              nextExtract.themes,
              nextExtract.codeToTheme
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
            themeMetrics: metrics.themeMetrics,
          };
        })
      );
      setSequenceDiffs(diffs);
    };

    if (sequences.length > 0) computeDiffs();
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
      <h1 className="text-2xl font-bold mb-4 text-gray-800">Themes Results</h1>
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
                <strong>Precision:</strong> {seqDiff.precision.toFixed(3)}
              </p>
              <p>
                <strong>Recall:</strong> {seqDiff.recall.toFixed(3)}
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
              Theme Metrics
            </h3>
            {seqDiff.themeMetrics.length > 0 ? (
              <table className="table-auto w-full border-collapse border border-gray-300 mb-4">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-2 border">Theme ID</th>
                    <th className="p-2 border">Initial Name</th>
                    <th className="p-2 border">Final Name</th>
                    <th className="p-2 border">Similarity</th>
                    <th className="p-2 border">Precision</th>
                    <th className="p-2 border">Recall</th>
                  </tr>
                </thead>
                <tbody>
                  {seqDiff.themeMetrics.map((metric, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="p-2 border">{metric.themeId}</td>
                      <td className="p-2 border">{metric.initialName}</td>
                      <td className="p-2 border">{metric.finalName}</td>
                      <td className="p-2 border">
                        {metric.similarity !== undefined
                          ? metric.similarity.toFixed(3)
                          : "N/A"}
                      </td>
                      <td className="p-2 border">
                        {metric.precision.toFixed(3)}
                      </td>
                      <td className="p-2 border">{metric.recall.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="mb-4 text-gray-600">No theme metrics available.</p>
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

export default ThemesDiffViewer;

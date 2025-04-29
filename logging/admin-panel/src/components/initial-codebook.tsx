import React, { useState, useEffect, useRef } from "react";
import { useDatabase } from "./context";
import { DatabaseRow } from "../utils/types";

interface CodeObject {
  id: string;
  code: string;
  definition: string;
}

interface CodebookDiff {
  inserted: CodeObject[];
  deleted: CodeObject[];
  updated: {
    codeName: string;
    codeId?: string;
    changes: {
      field: string;
      oldValue: string;
      newValue: string;
      similarity?: number;
    }[];
  }[];
  averageCosineSimilarity?: number;
}

interface SequenceDiff {
  sequenceId: number;
  initialTimestamp: string;
  finalTimestamp: string;
  isRegeneration: boolean;
  overallChanges: CodebookDiff;
  stepwiseChanges: { step: number; changes: CodebookDiff }[];
  metrics: {
    inserted: number;
    deleted: number;
    updated: number;
    averageCosineSimilarity: number;
  };
}

const safeParseContext = (context: string): any => {
  try {
    return JSON.parse(context);
  } catch {
    return {};
  }
};

const groupCodebookSequences = (entries: DatabaseRow[]): DatabaseRow[][] => {
  const sequences: DatabaseRow[][] = [];
  let currentSequence: DatabaseRow[] = [];
  for (const entry of entries) {
    const context = safeParseContext(entry.context);
    if (
      context.function === "manual_codebook_generation" ||
      context.function === "initial_codebook"
    ) {
      if (currentSequence.length > 0) sequences.push(currentSequence);
      currentSequence = [entry];
    } else if (
      context.function === "dispatchInitialCodebookTable" &&
      currentSequence.length > 0
    ) {
      currentSequence.push(entry);
    }
  }
  if (currentSequence.length > 0) sequences.push(currentSequence);
  return sequences;
};

const extractCodebook = (state: any): CodeObject[] => {
  if (state.current_state) {
    return state.current_state as CodeObject[];
  } else if (state.codebook) {
    if (Array.isArray(state.codebook)) {
      return state.codebook as CodeObject[];
    } else {
      return Object.entries(state.codebook as Record<string, string>).map(
        ([code, definition]) => ({
          id: "",
          code,
          definition,
        })
      );
    }
  }
  return [];
};

const computeCodebookDiff = async (
  prevCodebook: CodeObject[],
  currCodebook: CodeObject[],
  calculateSimilarity: (a: string, b: string) => Promise<number>
): Promise<CodebookDiff> => {
  const prevMap = new Map(prevCodebook.map((code) => [code.code, code]));
  const currMap = new Map(currCodebook.map((code) => [code.code, code]));
  const inserted = currCodebook.filter((code) => !prevMap.has(code.code));
  const deleted = prevCodebook.filter((code) => !currMap.has(code.code));
  const updated: {
    codeName: string;
    codeId?: string;
    changes: {
      field: string;
      oldValue: string;
      newValue: string;
      similarity?: number;
    }[];
  }[] = [];

  let similaritySum = 0;
  const similarityCount = prevCodebook.length;

  for (const [codeName, currCode] of currMap) {
    if (prevMap.has(codeName)) {
      const prevCode = prevMap.get(codeName)!;
      const changes: {
        field: string;
        oldValue: string;
        newValue: string;
        similarity?: number;
      }[] = [];
      if (prevCode.definition !== currCode.definition) {
        const similarity = await calculateSimilarity(
          prevCode.definition,
          currCode.definition
        );
        changes.push({
          field: "definition",
          oldValue: prevCode.definition,
          newValue: currCode.definition,
          similarity,
        });
        similaritySum += similarity;
      } else {
        similaritySum++;
      }
      if (changes.length > 0) {
        updated.push({ codeName, codeId: currCode.id, changes });
      }
    }
  }

  console.log("Similarity Sum:", similaritySum, "Count:", similarityCount);
  return {
    inserted,
    deleted,
    updated,
    averageCosineSimilarity:
      similarityCount > 0 ? similaritySum / similarityCount : 0,
  };
};

const parseDiffFromState = async (
  state: any,
  calculateSimilarity: (a: string, b: string) => Promise<number>
): Promise<CodebookDiff> => {
  const diff: { inserted: any[]; deleted: any[]; updated: any[] } =
    state.diff || {
      inserted: [],
      deleted: [],
      updated: [],
    };
  const normalizedUpdated = await Promise.all(
    diff.updated.map(async (update) => {
      const changesArray = await Promise.all(
        Object.entries((update.changes || {}) as Record<string, any>).map(
          async ([field, change]) => {
            const similarity = await calculateSimilarity(
              change.old,
              change.new
            );
            return {
              field,
              oldValue: change.old,
              newValue: change.new,
              similarity,
            };
          }
        )
      );
      const codeName =
        state.current_state?.find((code: any) => code.id === update.id)?.code ||
        "Unknown";
      return {
        codeId: update.id,
        codeName,
        changes: changesArray,
      };
    })
  );
  return {
    inserted: diff.inserted.map((code) => ({
      id: code.id,
      code: code.code,
      definition: code.definition,
    })),
    deleted: diff.deleted.map((code) => ({
      id: code.id,
      code: code.code,
      definition: code.definition,
    })),
    updated: normalizedUpdated,
  };
};

const CodebookDiffViewer: React.FC = () => {
  const {
    isDatabaseLoaded,
    executeQuery,
    calculateSimilarity,
    selectedWorkspaceId,
  } = useDatabase();
  const [sequences, setSequences] = useState<DatabaseRow[][]>([]);
  const [sequenceDiffs, setSequenceDiffs] = useState<SequenceDiff[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
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
        const query: string = `
          SELECT * FROM state_dumps
          WHERE json_extract(context, '$.function') IN ('manual_codebook_generation', 'initial_codebook', 'dispatchInitialCodebookTable')
            AND json_extract(context, '$.workspace_id') = ?
          ORDER BY created_at ASC
        `;
        const result: DatabaseRow[] = await executeQuery(query, [
          selectedWorkspaceId,
        ]);
        setSequences(groupCodebookSequences(result));
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
        sequences.map(async (sequence: DatabaseRow[], seqIndex: number) => {
          const initialEntry: DatabaseRow = sequence[0];
          const initialContext: any = safeParseContext(initialEntry.context);
          const isRegeneration: boolean = initialContext.run === "regenerate";
          const initialState: any = JSON.parse(initialEntry.state);
          const initialCodebook: CodeObject[] = extractCodebook(initialState);
          const finalState: any =
            sequence.length > 1
              ? JSON.parse(sequence[sequence.length - 1].state)
              : initialState;
          const finalCodebook: CodeObject[] = extractCodebook(finalState);
          const overallChanges: CodebookDiff = await computeCodebookDiff(
            initialCodebook,
            finalCodebook,
            getSimilarity
          );
          const stepwiseChanges: { step: number; changes: CodebookDiff }[] = [];
          let prevCodebook: CodeObject[] = initialCodebook;

          for (let i = 1; i < sequence.length; i++) {
            const entry: DatabaseRow = sequence[i];
            const state: any = JSON.parse(entry.state);
            let diff: CodebookDiff = await parseDiffFromState(
              state,
              getSimilarity
            );
            if (!diff.inserted || !diff.deleted || !diff.updated) {
              const currCodebook: CodeObject[] = extractCodebook(state);
              diff = await computeCodebookDiff(
                prevCodebook,
                currCodebook,
                getSimilarity
              );
              prevCodebook = currCodebook;
            }
            stepwiseChanges.push({ step: i, changes: diff });
          }

          const metrics: {
            inserted: number;
            deleted: number;
            updated: number;
            averageCosineSimilarity: number;
          } = {
            inserted: overallChanges.inserted.length,
            deleted: overallChanges.deleted.length,
            updated: overallChanges.updated.length,
            averageCosineSimilarity:
              overallChanges.averageCosineSimilarity || 0,
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
            overallChanges,
            stepwiseChanges,
            metrics,
          } as SequenceDiff;
        })
      );
      setSequenceDiffs(diffs);
    };

    if (sequences.length > 0) computeDiffs();
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
        Codebook Diff Viewer
      </h1>
      <p className="mb-4 text-gray-600">
        Total number of regenerations: {totalRegenerations}
      </p>
      {sequenceDiffs.length === 0 ? (
        <p className="text-gray-600">No sequences found.</p>
      ) : (
        sequenceDiffs.map((seqDiff: SequenceDiff) => (
          <div key={seqDiff.sequenceId} className="mb-8">
            <h2 className="text-xl font-semibold mb-2 text-gray-700">
              Sequence {seqDiff.sequenceId}: {seqDiff.initialTimestamp} to{" "}
              {seqDiff.finalTimestamp} (
              {seqDiff.isRegeneration ? "Regeneration" : "Initial Generation"})
            </h2>
            <div className="mb-4 text-gray-600">
              <p>
                <strong>Updated Codes:</strong> {seqDiff.metrics.updated}
              </p>
              <p>
                <strong>Average cosine similarity:</strong>{" "}
                {seqDiff.metrics.averageCosineSimilarity.toFixed(3)}
              </p>
            </div>
            <h3 className="text-lg font-medium mb-2 text-gray-700">
              Overall Changes
            </h3>
            <div className="mb-4">
              <h4 className="text-md font-medium text-gray-600">
                Updated Codes
              </h4>
              {seqDiff.overallChanges.updated.length > 0 ? (
                <table className="table-auto w-full border-collapse border border-gray-300 mb-4">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="p-2 border">Code</th>
                      <th className="p-2 border">Field</th>
                      <th className="p-2 border">Old Value</th>
                      <th className="p-2 border">New Value</th>
                      <th className="p-2 border">Similarity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {seqDiff.overallChanges.updated.flatMap(
                      (update, updateIndex) =>
                        update.changes.map((change, changeIndex) => (
                          <tr
                            key={`overall-updated-${updateIndex}-${changeIndex}`}
                            className="hover:bg-gray-50"
                          >
                            <td className="p-2 border">{update.codeName}</td>
                            <td className="p-2 border">{change.field}</td>
                            <td className="p-2 border">{change.oldValue}</td>
                            <td className="p-2 border">{change.newValue}</td>
                            <td className="p-2 border">
                              {change.similarity?.toFixed(3) || "N/A"}
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              ) : (
                <p className="mb-4 text-gray-600">No updated codes.</p>
              )}
            </div>
            <h3 className="text-lg font-medium mb-2 text-gray-700">
              Stepwise Changes
            </h3>
            {seqDiff.stepwiseChanges.length > 0 ? (
              seqDiff.stepwiseChanges.map(
                (step: { step: number; changes: CodebookDiff }) => (
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
                          Inserted Codes
                        </h5>
                        {step.changes.inserted.length > 0 ? (
                          <table className="table-auto w-full border-collapse border border-gray-300 mb-4">
                            <thead>
                              <tr className="bg-gray-100">
                                <th className="p-2 border">Code</th>
                                <th className="p-2 border">Definition</th>
                              </tr>
                            </thead>
                            <tbody>
                              {step.changes.inserted.map(
                                (code: CodeObject, index: number) => (
                                  <tr
                                    key={`step-${step.step}-inserted-${index}`}
                                    className="hover:bg-gray-50"
                                  >
                                    <td className="p-2 border">{code.code}</td>
                                    <td className="p-2 border">
                                      {code.definition}
                                    </td>
                                  </tr>
                                )
                              )}
                            </tbody>
                          </table>
                        ) : (
                          <p className="mb-4 text-gray-600">
                            No inserted codes in this step.
                          </p>
                        )}

                        <h5 className="text-sm font-medium text-gray-500">
                          Deleted Codes
                        </h5>
                        {step.changes.deleted.length > 0 ? (
                          <table className="table-auto w-full border-collapse border border-gray-300 mb-4">
                            <thead>
                              <tr className="bg-gray-100">
                                <th className="p-2 border">Code</th>
                                <th className="p-2 border">Definition</th>
                              </tr>
                            </thead>
                            <tbody>
                              {step.changes.deleted.map(
                                (code: CodeObject, index: number) => (
                                  <tr
                                    key={`step-${step.step}-deleted-${index}`}
                                    className="hover:bg-gray-50"
                                  >
                                    <td className="p-2 border">{code.code}</td>
                                    <td className="p-2 border">
                                      {code.definition}
                                    </td>
                                  </tr>
                                )
                              )}
                            </tbody>
                          </table>
                        ) : (
                          <p className="mb-4 text-gray-600">
                            No deleted codes in this step.
                          </p>
                        )}

                        <h5 className="text-sm font-medium text-gray-500">
                          Updated Codes
                        </h5>
                        {step.changes.updated.length > 0 ? (
                          <table className="table-auto w-full border-collapse border border-gray-300 mb-4">
                            <thead>
                              <tr className="bg-gray-100">
                                <th className="p-2 border">Code</th>
                                <th className="p-2 border">Field</th>
                                <th className="p-2 border">Old Value</th>
                                <th className="p-2 border">New Value</th>
                                <th className="p-2 border">Similarity</th>
                              </tr>
                            </thead>
                            <tbody>
                              {step.changes.updated.flatMap(
                                (update, updateIndex) =>
                                  update.changes.map((change, changeIndex) => (
                                    <tr
                                      key={`step-${step.step}-updated-${updateIndex}-${changeIndex}`}
                                      className="hover:bg-gray-50"
                                    >
                                      <td className="p-2 border">
                                        {update.codeName}
                                      </td>
                                      <td className="p-2 border">
                                        {change.field}
                                      </td>
                                      <td className="p-2 border">
                                        {change.oldValue}
                                      </td>
                                      <td className="p-2 border">
                                        {change.newValue}
                                      </td>
                                      <td className="p-2 border">
                                        {change.similarity?.toFixed(3) || "N/A"}
                                      </td>
                                    </tr>
                                  ))
                              )}
                            </tbody>
                          </table>
                        ) : (
                          <p className="mb-4 text-gray-600">
                            No updated codes in this step.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )
              )
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

export default CodebookDiffViewer;

import React, { useState, useEffect, useRef } from "react";
import { useDatabase } from "./context";
import WorkerPool from "./worker-pool";
import { DatabaseRow, Context, CodingResult } from "../utils/types";

interface FieldChange {
  type:
    | "model_changed"
    | "quote_changed"
    | "code_changed"
    | "explanation_changed"
    | "chat_history_changed"
    | "is_marked_changed"
    | "range_marker_changed";
  resultId: string;
  oldValue: any;
  newValue: any;
  similarity?: number;
  code: string;
  quote: string;
  post_id?: string;
}

interface CRUDChanges {
  inserted: CodingResult[];
  updated: FieldChange[];
  deleted: CodingResult[];
}

interface SequenceDiff {
  sequenceId: number;
  initialTimestamp: string;
  finalTimestamp: string;
  isRegeneration: boolean;
  changes: CRUDChanges;
  stepwiseChanges: { step: number; changes: CRUDChanges }[];
  precision: number;
  recall: number;
  codeKappas: { code: string; kappa: number }[];
  cohenKappa: number;
  krippendorffAlpha: number;
  llmAddedCorrect: number;
  humanNotInLlmCorrect: number;
  matchingQuotes: number;
  percentageAgreement: number;
}

interface SequenceState {
  diff: SequenceDiff | null;
  isLoading: boolean;
  error?: string;
}

interface CodeToQuoteIdsResult {
  codeToQuoteIds: Record<string, string[]>;
  allQuoteIds: string[];
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
    if (context.function === "final_codes") {
      if (currentSequence.length > 0) sequences.push(currentSequence);
      currentSequence = [entry];
    } else if (
      context.function === "dispatchUnseenPostResponse" &&
      currentSequence.length > 0
    ) {
      currentSequence.push(entry);
    }
  }
  if (currentSequence.length > 0) sequences.push(currentSequence);
  return sequences;
};

const extractResults = (
  state: any,
  stateType: "generation" | "dispatch"
): Map<string, CodingResult> => {
  const results = new Map<string, CodingResult>();
  const resultsArray =
    stateType === "generation" ? state.results : state.current_state;
  resultsArray.forEach((result: any) => {
    results.set(result.id, {
      id: result.id,
      model: result.model,
      quote: result.quote,
      code: result.code,
      explanation: result.explanation,
      post_id: result.post_id,
      chat_history: result.chat_history
        ? JSON.parse(result.chat_history)
        : null,
      is_marked:
        stateType === "generation"
          ? true
          : result.is_marked !== null
          ? Boolean(result.is_marked)
          : null,
      range_marker: result.range_marker
        ? JSON.parse(result.range_marker)
        : null,
      response_type: result.response_type,
    });
  });
  console.log(
    `Extracted ${results.size} results from ${stateType} state.`,
    resultsArray
  );
  return results;
};

const computeChanges = async (
  prevResults: Map<string, CodingResult>,
  currResults: Map<string, CodingResult>,
  getSimilarity: (textA: string, textB: string) => Promise<number>
): Promise<CRUDChanges> => {
  const prevIds = new Set(prevResults.keys());
  const currIds = new Set(currResults.keys());

  const inserted = [...currIds]
    .filter((id) => !prevIds.has(id))
    .map((id) => currResults.get(id)!);
  const deleted = [...prevIds]
    .filter((id) => !currIds.has(id))
    .map((id) => prevResults.get(id)!);
  const updated: FieldChange[] = [];

  const commonIds = [...prevIds].filter((id) => currIds.has(id));

  for (const id of commonIds) {
    const prev = prevResults.get(id);
    const curr = currResults.get(id);
    if (prev && curr) {
      if (prev.quote !== curr.quote) {
        const similarity = await getSimilarity(prev.quote, curr.quote);
        updated.push({
          type: "quote_changed",
          resultId: id,
          oldValue: prev.quote,
          newValue: curr.quote,
          similarity,
          code: curr.code,
          quote: curr.quote,
          post_id: curr.post_id,
        });
      }
      if (prev.code !== curr.code) {
        const similarity = await getSimilarity(prev.code, curr.code);
        updated.push({
          type: "code_changed",
          resultId: id,
          oldValue: prev.code,
          newValue: curr.code,
          similarity,
          code: curr.code,
          quote: curr.quote,
          post_id: curr.post_id,
        });
      }
      if (prev.is_marked !== curr.is_marked) {
        updated.push({
          type: "is_marked_changed",
          resultId: id,
          oldValue: prev.is_marked,
          newValue: curr.is_marked,
          code: curr.code,
          quote: curr.quote,
          post_id: curr.post_id,
        });
      }
    }
  }

  return { inserted, updated, deleted };
};

const computeMetrics = async (
  initialResults: Map<string, CodingResult>,
  finalResults: Map<string, CodingResult>,
  getSimilarity: (textA: string, textB: string) => Promise<number>
): Promise<{ precision: number; recall: number }> => {
  const initialIds = new Set(initialResults.keys());
  const finalIds = new Set(finalResults.keys());
  const commonIds = [...initialIds].filter((id) => finalIds.has(id));
  const insertedIds = [...finalIds].filter((id) => !initialIds.has(id));
  const deletedIds = [...initialIds].filter((id) => !finalIds.has(id));

  let TP = 0;
  let unweightedTP = 0;
  for (const id of commonIds) {
    const initial = initialResults.get(id)!;
    const final = finalResults.get(id)!;
    const quoteSim = await getSimilarity(initial.quote, final.quote);
    const codeSim = await getSimilarity(initial.code, final.code);
    const avgSim = (quoteSim + codeSim) / 2;
    TP += avgSim;
    unweightedTP++;
  }

  const falseMarkedCount = commonIds.filter((id) => {
    const final = finalResults.get(id)!;
    return final.is_marked === false;
  }).length;
  const FP = deletedIds.length + falseMarkedCount;

  const FN = insertedIds.filter((id) => {
    const final = finalResults.get(id)!;
    return final.is_marked === true;
  }).length;

  const precision = unweightedTP + FP > 0 ? TP / (unweightedTP + FP) : 0;
  const recall = unweightedTP + FN > 0 ? TP / (unweightedTP + FN) : 0;

  return { precision, recall };
};

const masiDistance = (setA: Set<string>, setB: Set<string>): number => {
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  const len_intersection = intersection.size;
  const len_union = union.size;
  const len_label1 = setA.size;
  const len_label2 = setB.size;

  let m: number;
  if (len_label1 === len_label2 && len_label1 === len_intersection) {
    m = 1;
  } else if (len_intersection === Math.min(len_label1, len_label2)) {
    m = 0.67;
  } else if (len_intersection > 0) {
    m = 0.33;
  } else {
    m = 0;
  }

  const jaccard = len_union === 0 ? 1 : len_intersection / len_union;
  return 1 - jaccard * m;
};

const calculateKrippendorffAlpha = (
  data: { coder: string; item: string; labels: Set<string> }[]
): number => {
  const items = Array.from(new Set(data.map((d) => d.item)));

  const annotations: { [item: string]: { [coder: string]: Set<string> } } = {};
  data.forEach((d) => {
    if (!annotations[d.item]) annotations[d.item] = {};
    annotations[d.item][d.coder] = d.labels;
  });

  const annotationTable = items.map((item) => ({
    item,
    llm: Array.from(annotations[item]?.llm || []),
    human: Array.from(annotations[item]?.human || []),
  }));
  console.table(annotationTable);

  let Do = 0;
  let count = 0;
  items.forEach((item) => {
    const llmLabels = annotations[item]?.llm || new Set();
    const humanLabels = annotations[item]?.human || new Set();
    if (llmLabels && humanLabels) {
      const distance = masiDistance(llmLabels, humanLabels);
      Do += distance;
      count++;
    }
  });
  Do = count > 0 ? Do / count : 0;
  console.log(`Observed disagreement (Do): ${Do}`);

  let De = 0;
  let deCount = 0;
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const setA = annotations[items[i]]?.llm || new Set();
      const setB = annotations[items[j]]?.human || new Set();
      const distance = masiDistance(setA, setB);
      De += distance;
      deCount++;
    }
  }
  De = deCount > 0 ? De / deCount : 0;
  console.log(`Expected disagreement (De): ${De}`);

  const alpha = De > 0 ? 1 - Do / De : 1;
  console.log(`Krippendorff's Alpha: ${alpha}`);
  return alpha;
};

const FinalCodingResultsDiffViewer: React.FC = () => {
  const {
    isDatabaseLoaded,
    executeQuery,
    calculateSimilarity,
    selectedWorkspaceId,
    workerPoolRef,
  } = useDatabase();

  const mappingPoolRef = useRef<WorkerPool | null>(null);

  useEffect(() => {
    mappingPoolRef.current = new WorkerPool(
      new URL("./coding-transcript-worker.js", import.meta.url).href,
      4
    );
    return () => {
      mappingPoolRef.current?.terminate();
    };
  }, []);

  const [sequences, setSequences] = useState<DatabaseRow[][]>([]);
  const [sequenceStates, setSequenceStates] = useState<SequenceState[]>([]);
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

  const batchFetchPostsAndComments = async (
    postIds: string[]
  ): Promise<any[]> => {
    if (!workerPoolRef.current) {
      throw new Error("Worker pool not initialized");
    }
    if (postIds.length === 0) return [];

    const NUM_CHUNKS = 4;
    const chunkSize = Math.ceil(postIds.length / NUM_CHUNKS);
    const chunks: string[][] = [];
    for (let i = 0; i < postIds.length; i += chunkSize) {
      chunks.push(postIds.slice(i, i + chunkSize));
    }

    const results = await Promise.all(
      chunks.map((chunk, idx) =>
        workerPoolRef.current!.runTask<any[]>(
          {
            type: "fetchPostsAndCommentsBatch",
            workspaceId: selectedWorkspaceId as string,
            postIds: chunk,
            id: `${chunk.join(",")}-${new Date().getTime()}-${idx}`,
          },
          {
            responseType: "fetchPostsAndCommentsBatchResult",
            errorType: "error",
          }
        )
      )
    );

    const allPosts = results.flat();
    const seen = new Set<string | number>();
    return allPosts.filter((post) => {
      if (seen.has(post.id)) return false;
      seen.add(post.id);
      return true;
    });
  };

  useEffect(() => {
    const fetchEntries = async () => {
      setIsLoading(true);
      try {
        const query = `
          SELECT * FROM state_dumps
          WHERE json_extract(context, '$.function') IN ('final_codes', 'dispatchUnseenPostResponse')
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

  const computeSequenceDiff = async (
    sequence: DatabaseRow[],
    seqIndex: number
  ): Promise<SequenceDiff> => {
    const initialEntry = sequence[0];
    const initialContext = safeParseContext(initialEntry.context);
    const isRegeneration = initialContext.run === "regenerate";
    const initialState = JSON.parse(initialEntry.state);
    const finalState =
      sequence.length > 1
        ? JSON.parse(sequence[sequence.length - 1].state)
        : initialState;

    const initialResults = extractResults(initialState, "generation");
    const finalResultsRaw =
      sequence.length > 1
        ? extractResults(finalState, "dispatch")
        : initialResults;

    const finalResults = new Map(
      Array.from(finalResultsRaw.entries()).filter(
        ([_, result]) => result.is_marked === true
      )
    );

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

    const stepwiseChanges: { step: number; changes: CRUDChanges }[] = [];
    let prevResults = initialResults;
    for (let i = 1; i < sequence.length; i++) {
      const currState = JSON.parse(sequence[i].state);
      const currResults = extractResults(currState, "dispatch");
      const stepChanges = await computeChanges(
        prevResults,
        currResults,
        getSimilarity
      );
      if (
        stepChanges.inserted.length > 0 ||
        stepChanges.updated.length > 0 ||
        stepChanges.deleted.length > 0
      ) {
        stepwiseChanges.push({ step: i, changes: stepChanges });
      }
      prevResults = currResults;
    }

    const unseenPostIdsQuery = await executeQuery(
      `SELECT state FROM state_dumps 
       WHERE json_extract(context, '$.function') = 'sample_posts'
       AND json_extract(context, '$.workspace_id') = ?`,
      [selectedWorkspaceId]
    );
    const unseenPostIds: string[] = [
      ...new Set(
        unseenPostIdsQuery.flatMap((row: any) => {
          try {
            const state = JSON.parse(row.state);
            return state.groups?.unseen || [];
          } catch (e) {
            console.error("Failed to parse state JSON:", e);
            return [];
          }
        })
      ),
    ] as string[];
    if (unseenPostIds.length === 0) {
      throw new Error("No unseen post IDs found.");
    }

    const postGroups: Record<
      string,
      { llm: CodingResult[]; human: CodingResult[] }
    > = {};
    unseenPostIds.forEach((postId) => {
      postGroups[postId] = {
        llm: Array.from(initialResults.values()).filter(
          (r) => r.post_id === postId
        ),
        human: Array.from(finalResults.values()).filter(
          (r) => r.post_id === postId
        ),
      };
    });

    const allPosts = await batchFetchPostsAndComments(unseenPostIds);
    const postMap: Record<string, any> = {};
    allPosts.forEach((post) => {
      postMap[post.id] = post;
    });

    const llmMappings = await Promise.all(
      unseenPostIds.map((postId) =>
        mappingPoolRef.current!.runTask<CodeToQuoteIdsResult>(
          {
            type: "getCodeToQuoteIds",
            post: postMap[postId],
            codes: postGroups[postId].llm.map((r) => ({
              id: r.id,
              text: r.quote,
              code: r.code,
              rangeMarker: r.range_marker,
            })),
            id: `${postId}-llm-${new Date().getTime()}`,
          },
          {
            responseType: "getCodeToQuoteIdsResult",
            errorType: "error",
          }
        )
      )
    );

    const humanMappings = await Promise.all(
      unseenPostIds.map((postId) =>
        mappingPoolRef.current!.runTask<CodeToQuoteIdsResult>(
          {
            type: "getCodeToQuoteIds",
            post: postMap[postId],
            codes: postGroups[postId].human.map((r) => ({
              id: r.id,
              text: r.quote,
              code: r.code,
              rangeMarker: r.range_marker,
            })),
            id: `${postId}-human-${new Date().getTime()}`,
          },
          {
            responseType: "getCodeToQuoteIdsResult",
            errorType: "error",
          }
        )
      )
    );

    const llmQuoteToCodes: Record<string, Record<string, Set<string>>> = {};
    const humanQuoteToCodes: Record<string, Record<string, Set<string>>> = {};
    const allQuoteIds: Record<string, string[]> = {};

    unseenPostIds.forEach((postId, idx) => {
      const llmMapping = llmMappings[idx];
      const humanMapping = humanMappings[idx];
      allQuoteIds[postId] = [...new Set(llmMapping.allQuoteIds)];

      llmQuoteToCodes[postId] = {};
      for (const [codeId, quoteIds] of Object.entries(
        llmMapping.codeToQuoteIds
      )) {
        const code = postGroups[postId].llm.find((r) => r.id === codeId)?.code;
        if (code) {
          quoteIds.forEach((quoteId) => {
            if (!llmQuoteToCodes[postId][quoteId])
              llmQuoteToCodes[postId][quoteId] = new Set();
            llmQuoteToCodes[postId][quoteId].add(code);
          });
        }
      }

      humanQuoteToCodes[postId] = {};
      for (const [codeId, quoteIds] of Object.entries(
        humanMapping.codeToQuoteIds
      )) {
        const code = postGroups[postId].human.find(
          (r) => r.id === codeId
        )?.code;
        if (code) {
          quoteIds.forEach((quoteId) => {
            if (!humanQuoteToCodes[postId][quoteId])
              humanQuoteToCodes[postId][quoteId] = new Set();
            humanQuoteToCodes[postId][quoteId].add(code);
          });
        }
      }
    });

    const allCodes = new Set<string>();
    initialResults.forEach((r) => allCodes.add(r.code));
    finalResults.forEach((r) => allCodes.add(r.code));

    const codeKappas: { code: string; kappa: number }[] = [];
    let sumA = 0,
      sumB = 0,
      sumC = 0,
      sumD = 0;
    for (const code of allCodes) {
      let a = 0,
        b = 0,
        c = 0,
        d = 0;
      unseenPostIds.forEach((postId) => {
        let prevA = a,
          prevB = b,
          prevC = c,
          prevD = d;
        allQuoteIds[postId] = [...new Set(allQuoteIds[postId])];
        allQuoteIds[postId].forEach((quoteId) => {
          const llmApplied =
            llmQuoteToCodes[postId][quoteId]?.has(code) || false;
          const humanApplied =
            humanQuoteToCodes[postId][quoteId]?.has(code) || false;
          if (llmApplied && humanApplied) a++;
          else if (humanApplied) b++;
          else if (llmApplied) c++;
          else d++;
        });

        console.log(
          "Quote ids:",
          a - prevA,
          b - prevB,
          c - prevC,
          d - prevD,
          postId
        );
      });
      const N = a + b + c + d;
      if (N === 0) continue;
      sumA += a;
      sumB += b;
      sumC += c;
      sumD += d;
      const p0 = (a + d) / N;
      const pLLMYes = (a + c) / N;
      const pHumanYes = (a + b) / N;
      const pe = pLLMYes * pHumanYes + (1 - pLLMYes) * (1 - pHumanYes);
      const kappa = pe < 1 ? (p0 - pe) / (1 - pe) : p0 === 1 ? 1 : 0;
      codeKappas.push({ code, kappa });

      console.log(`Sequence ${seqIndex + 1}, Code: ${code}`);
      console.table({
        overlap: a,
        "human Agree": b,
        "llm Agree": c,
        disagree: d,
        total: N,
        p0: p0,
        pe: pe,
        kappa: kappa,
      });
    }

    const totalN = sumA + sumB + sumC + sumD;
    const p0 = totalN > 0 ? (sumA + sumD) / totalN : 0;
    const pLLMYes = totalN > 0 ? (sumA + sumC) / totalN : 0;
    const pHumanYes = totalN > 0 ? (sumA + sumB) / totalN : 0;
    const pe = pLLMYes * pHumanYes + (1 - pLLMYes) * (1 - pHumanYes);
    const cohenKappa = pe < 1 ? (p0 - pe) / (1 - pe) : p0 === 1 ? 1 : 0;
    const percentageAgreement = p0;

    const alphaData = unseenPostIds
      .flatMap((postId) =>
        allQuoteIds[postId].map((quoteId) => [
          {
            coder: "llm",
            item: quoteId,
            labels: llmQuoteToCodes[postId][quoteId] || new Set(),
          },
          {
            coder: "human",
            item: quoteId,
            labels: humanQuoteToCodes[postId][quoteId] || new Set(),
          },
        ])
      )
      .flat();

    const krippendorffAlpha = calculateKrippendorffAlpha(alphaData);

    const initialLLMResponses = Array.from(initialResults.values()).filter(
      (r) => r.response_type === "LLM"
    );
    const totalLLMResponses = Array.from(initialResults.values()).filter(
      (r) => r.response_type === "LLM"
    ).length;
    const correctLLMResponses = initialLLMResponses.filter(
      (r) => finalResults.has(r.id) && r.is_marked === true
    ).length;
    const llmAddedCorrect =
      initialLLMResponses.length > 0
        ? (correctLLMResponses / totalLLMResponses) * 100
        : 0;

    const humanNotInLlmCorrect = changes.inserted.length;
    const matchingQuotes = sumA;

    return {
      sequenceId: seqIndex + 1,
      initialTimestamp: new Date(initialEntry.created_at).toLocaleString(),
      finalTimestamp: new Date(
        sequence[sequence.length - 1].created_at
      ).toLocaleString(),
      isRegeneration,
      changes,
      stepwiseChanges,
      precision,
      recall,
      codeKappas,
      cohenKappa,
      krippendorffAlpha,
      llmAddedCorrect,
      humanNotInLlmCorrect,
      matchingQuotes,
      percentageAgreement,
    };
  };

  useEffect(() => {
    if (sequences.length > 0) {
      setSequenceStates(sequences.map(() => ({ diff: null, isLoading: true })));
      sequences.forEach((sequence, index) => {
        computeSequenceDiff(sequence, index)
          .then((diff) => {
            setSequenceStates((prev) => {
              const newStates = [...prev];
              newStates[index] = { diff, isLoading: false };
              return newStates;
            });
          })
          .catch((error) => {
            console.error(
              `Error computing diff for sequence ${index + 1}:`,
              error
            );
            setSequenceStates((prev) => {
              const newStates = [...prev];
              newStates[index] = {
                diff: null,
                isLoading: false,
                error: error.message,
              };
              return newStates;
            });
          });
      });
    }
  }, [sequences]);

  const toggleStep = (step: number) => {
    setOpenSteps((prev) => ({ ...prev, [step]: !prev[step] }));
  };

  const totalRegenerations = sequenceStates.reduce(
    (count, state) => count + (state.diff && state.diff.isRegeneration ? 1 : 0),
    0
  );

  if (isLoading)
    return <p className="p-4 text-gray-600">Loading sequences...</p>;
  if (!isDatabaseLoaded)
    return <p className="p-4 text-gray-600">Please select a database first.</p>;

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">
        Final Coding Results
      </h1>
      <p className="mb-4 text-gray-600">
        Total number of regenerations: {totalRegenerations}
      </p>
      {sequenceStates.length === 0 ? (
        <p className="text-gray-600">No sequences found.</p>
      ) : (
        sequenceStates.map((state, index) => {
          if (state.isLoading) {
            return (
              <div key={index} className="mb-8 p-4 bg-gray-100 rounded-lg">
                <h2 className="text-xl font-semibold mb-2 text-gray-700">
                  Sequence {index + 1}
                </h2>
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-blue-500 mr-2" />
                  <p className="text-gray-600">Loading...</p>
                </div>
              </div>
            );
          } else if (state.error) {
            return (
              <div key={index} className="mb-8 p-4 bg-red-100 rounded-lg">
                <h2 className="text-xl font-semibold mb-2 text-red-700">
                  Sequence {index + 1}: Error
                </h2>
                <p className="text-red-600">{state.error}</p>
              </div>
            );
          } else {
            const seqDiff = state.diff!;
            const groupedUpdates = seqDiff.changes.updated.reduce(
              (acc, change) => {
                if (!acc[change.type]) acc[change.type] = [];
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
                  {seqDiff.isRegeneration
                    ? "Regeneration"
                    : "Initial Generation"}
                  )
                </h2>
                <div className="mb-4 text-gray-600">
                  <p>
                    <strong>Weighted Precision:</strong> {seqDiff.precision}
                  </p>
                  <p>
                    <strong>Weighted Recall:</strong> {seqDiff.recall}
                  </p>
                  <p>
                    <strong>Cohen's Kappa:</strong> {seqDiff.cohenKappa}
                  </p>
                  <p>
                    <strong>Krippendorff's Alpha:</strong>{" "}
                    {seqDiff.krippendorffAlpha}
                  </p>
                  <p>
                    <strong>LLM Added Correct:</strong>{" "}
                    {seqDiff.llmAddedCorrect}%
                  </p>
                  <p>
                    <strong>Human Not In LLM Correct:</strong>{" "}
                    {seqDiff.humanNotInLlmCorrect}
                  </p>
                  <p>
                    <strong>Matching Quotes:</strong> {seqDiff.matchingQuotes}
                  </p>
                  <p>
                    <strong>Percentage Agreement:</strong>{" "}
                    {seqDiff.percentageAgreement}
                  </p>
                </div>
                {seqDiff.codeKappas.length > 0 && (
                  <div className="mb-4 p-2 bg-gray-50 rounded-lg">
                    <h4 className="text-md font-medium text-gray-600">
                      Per-Code Cohen's Kappa
                    </h4>
                    <table className="w-full border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="p-2 border">Code</th>
                          <th className="p-2 border">Kappa</th>
                        </tr>
                      </thead>
                      <tbody>
                        {seqDiff.codeKappas.map(({ code, kappa }) => (
                          <tr key={code} className="hover:bg-gray-50">
                            <td className="p-2 border">{code}</td>
                            <td className="p-2 border">{kappa}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <h3 className="text-lg font-medium mb-2 text-gray-700">
                  Initial vs Final Changes
                </h3>
                <div>
                  <h4 className="text-md font-medium text-gray-600">
                    Inserted Results
                  </h4>
                  {seqDiff.changes.inserted.length > 0 ? (
                    <table className="table-auto w-full border-collapse border border-gray-300 mb-4">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="p-2 border">ID</th>
                          <th className="p-2 border">Quote</th>
                          <th className="p-2 border">Code</th>
                        </tr>
                      </thead>
                      <tbody>
                        {seqDiff.changes.inserted.map((result) => (
                          <tr key={result.id}>
                            <td className="p-2 border">{result.id}</td>
                            <td className="p-2 border">{result.quote}</td>
                            <td className="p-2 border">{result.code}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="mb-2 text-gray-600">No inserted results.</p>
                  )}

                  <h4 className="text-md font-medium text-gray-600">
                    Updated Results
                  </h4>
                  {Object.entries(groupedUpdates).length > 0 ? (
                    Object.entries(groupedUpdates).map(([type, changes]) => (
                      <div key={type} className="mb-4">
                        <h5 className="text-sm font-medium text-gray-500">
                          {type
                            .replace(/_/g, " ")
                            .replace(/\b\w/g, (c) => c.toUpperCase())}
                        </h5>
                        <table className="table-auto w-full border-collapse border border-gray-300 mb-2">
                          <thead>
                            <tr className="bg-gray-100">
                              <th className="p-2 border">Result ID</th>
                              <th className="p-2 border">Code</th>
                              <th className="p-2 border">Quote</th>
                              {type === "quote_changed" && (
                                <>
                                  <th className="p-2 border">Old Quote</th>
                                  <th className="p-2 border">New Quote</th>
                                  <th className="p-2 border">Similarity</th>
                                </>
                              )}
                              {type === "code_changed" && (
                                <>
                                  <th className="p-2 border">Old Code</th>
                                  <th className="p-2 border">New Code</th>
                                  <th className="p-2 border">Similarity</th>
                                </>
                              )}
                              {type === "is_marked_changed" && (
                                <>
                                  <th className="p-2 border">Old Is Marked</th>
                                  <th className="p-2 border">New Is Marked</th>
                                </>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {changes.map((change, index) => (
                              <tr key={index} className="hover:bg-gray-50">
                                <td className="p-2 border">
                                  {change.resultId}
                                </td>
                                <td className="p-2 border">{change.code}</td>
                                <td className="p-2 border">{change.quote}</td>
                                {type === "quote_changed" && (
                                  <>
                                    <td className="p-2 border">
                                      {change.oldValue}
                                    </td>
                                    <td className="p-2 border">
                                      {change.newValue}
                                    </td>
                                    <td className="p-2 border">
                                      {change.similarity}
                                    </td>
                                  </>
                                )}
                                {type === "code_changed" && (
                                  <>
                                    <td className="p-2 border">
                                      {change.oldValue}
                                    </td>
                                    <td className="p-2 border">
                                      {change.newValue}
                                    </td>
                                    <td className="p-2 border">
                                      {change.similarity}
                                    </td>
                                  </>
                                )}
                                {type === "is_marked_changed" && (
                                  <>
                                    <td className="p-2 border">
                                      {change.oldValue ? "Yes" : "No"}
                                    </td>
                                    <td className="p-2 border">
                                      {change.newValue ? "Yes" : "No"}
                                    </td>
                                  </>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))
                  ) : (
                    <p className="mb-2 text-gray-600">No updated results.</p>
                  )}

                  <h4 className="text-md font-medium text-gray-600">
                    Deleted Results
                  </h4>
                  {seqDiff.changes.deleted.length > 0 ? (
                    <table className="table-auto w-full border-collapse border border-gray-300 mb-4">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="p-2 border">ID</th>
                          <th className="p-2 border">Quote</th>
                          <th className="p-2 border">Code</th>
                        </tr>
                      </thead>
                      <tbody>
                        {seqDiff.changes.deleted.map((result) => (
                          <tr key={result.id}>
                            <td className="p-2 border">{result.id}</td>
                            <td className="p-2 border">{result.quote}</td>
                            <td className="p-2 border">{result.code}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="mb-2 text-gray-600">No deleted results.</p>
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
                            Inserted Results
                          </h5>
                          {step.changes.inserted.length > 0 ? (
                            <table className="table-auto w-full border-collapse border border-gray-300 mb-2">
                              <thead>
                                <tr className="bg-gray-100">
                                  <th className="p-2 border">ID</th>
                                  <th className="p-2 border">Quote</th>
                                  <th className="p-2 border">Code</th>
                                </tr>
                              </thead>
                              <tbody>
                                {step.changes.inserted.map((result) => (
                                  <tr key={result.id}>
                                    <td className="p-2 border">{result.id}</td>
                                    <td className="p-2 border">
                                      {result.quote}
                                    </td>
                                    <td className="p-2 border">
                                      {result.code}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <p className="mb-2 text-gray-600">
                              No inserted results in this step.
                            </p>
                          )}

                          <h5 className="text-sm font-medium text-gray-500">
                            Updated Results
                          </h5>
                          {step.changes.updated.length > 0 ? (
                            Object.entries(
                              step.changes.updated.reduce((acc, change) => {
                                if (!acc[change.type]) acc[change.type] = [];
                                acc[change.type].push(change);
                                return acc;
                              }, {} as { [key: string]: FieldChange[] })
                            ).map(([type, changes]) => (
                              <div key={type} className="mb-4">
                                <h6 className="text-xs font-medium text-gray-400">
                                  {type
                                    .replace(/_/g, " ")
                                    .replace(/\b\w/g, (c) => c.toUpperCase())}
                                </h6>
                                <table className="table-auto w-full border-collapse border border-gray-300 mb-2">
                                  <thead>
                                    <tr className="bg-gray-100">
                                      <th className="p-2 border">Result ID</th>
                                      <th className="p-2 border">Code</th>
                                      <th className="p-2 border">Quote</th>
                                      {type === "quote_changed" && (
                                        <>
                                          <th className="p-2 border">
                                            Old Quote
                                          </th>
                                          <th className="p-2 border">
                                            New Quote
                                          </th>
                                          <th className="p-2 border">
                                            Similarity
                                          </th>
                                        </>
                                      )}
                                      {type === "code_changed" && (
                                        <>
                                          <th className="p-2 border">
                                            Old Code
                                          </th>
                                          <th className="p-2 border">
                                            New Code
                                          </th>
                                          <th className="p-2 border">
                                            Similarity
                                          </th>
                                        </>
                                      )}
                                      {type === "is_marked_changed" && (
                                        <>
                                          <th className="p-2 border">
                                            Old Is Marked
                                          </th>
                                          <th className="p-2 border">
                                            New Is Marked
                                          </th>
                                        </>
                                      )}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {changes.map((change, index) => (
                                      <tr
                                        key={index}
                                        className="hover:bg-gray-50"
                                      >
                                        <td className="p-2 border">
                                          {change.resultId}
                                        </td>
                                        <td className="p-2 border">
                                          {change.code}
                                        </td>
                                        <td className="p-2 border">
                                          {change.quote}
                                        </td>
                                        {type === "quote_changed" && (
                                          <>
                                            <td className="p-2 border">
                                              {change.oldValue}
                                            </td>
                                            <td className="p-2 border">
                                              {change.newValue}
                                            </td>
                                            <td className="p-2 border">
                                              {change.similarity}
                                            </td>
                                          </>
                                        )}
                                        {type === "code_changed" && (
                                          <>
                                            <td className="p-2 border">
                                              {change.oldValue}
                                            </td>
                                            <td className="p-2 border">
                                              {change.newValue}
                                            </td>
                                            <td className="p-2 border">
                                              {change.similarity}
                                            </td>
                                          </>
                                        )}
                                        {type === "is_marked_changed" && (
                                          <>
                                            <td className="p-2 border">
                                              {change.oldValue ? "Yes" : "No"}
                                            </td>
                                            <td className="p-2 border">
                                              {change.newValue ? "Yes" : "No"}
                                            </td>
                                          </>
                                        )}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ))
                          ) : (
                            <p className="mb-2 text-gray-600">
                              No updated results in this step.
                            </p>
                          )}

                          <h5 className="text-sm font-medium text-gray-500">
                            Deleted Results
                          </h5>
                          {step.changes.deleted.length > 0 ? (
                            <table className="table-auto w-full border-collapse border border-gray-300 mb-2">
                              <thead>
                                <tr className="bg-gray-100">
                                  <th className="p-2 border">ID</th>
                                  <th className="p-2 border">Quote</th>
                                  <th className="p-2 border">Code</th>
                                </tr>
                              </thead>
                              <tbody>
                                {step.changes.deleted.map((result) => (
                                  <tr key={result.id}>
                                    <td className="p-2 border">{result.id}</td>
                                    <td className="p-2 border">
                                      {result.quote}
                                    </td>
                                    <td className="p-2 border">
                                      {result.code}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <p className="mb-2 text-gray-600">
                              No deleted results in this step.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-gray-600">No stepwise changes detected.</p>
                )}
              </div>
            );
          }
        })
      )}
    </div>
  );
};

export default FinalCodingResultsDiffViewer;

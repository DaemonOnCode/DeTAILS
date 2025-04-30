import React, { useState, useEffect, useRef } from "react";
import { useDatabase } from "./context";
import WorkerPool from "./worker-pool";
import { CodingResult, DatabaseRow } from "../utils/types";

interface ComparisonChange {
  postId: string;
  quote: string;
  type: "same_quote_different_code" | "human_only" | "llm_only";
  humanCode?: string;
  llmCode?: string;
  codeSimilarity?: number;
}

interface PostDiff {
  postId: string;
  changes: ComparisonChange[];
}

interface ComparisonMetrics {
  llmAcceptanceRate: number;
  llmAddedCorrect: number;
  humanNotInLlmCorrect: number;
  matchingQuotes: number;
  percentageAgreement: number;
  cohenKappa: number;
}

const ManualCodingComparisonViewer: React.FC = () => {
  const {
    isDatabaseLoaded,
    executeQuery,
    calculateSimilarity,
    selectedWorkspaceId,
    workerPoolRef,
  } = useDatabase();

  const mappingPoolRef = useRef(
    new WorkerPool(new URL("./transcript-worker.js", import.meta.url).href, 4)
  );

  useEffect(() => {
    mappingPoolRef.current = new WorkerPool(
      new URL("./transcript-worker.js", import.meta.url).href,
      4
    );
    return () => {
      if (mappingPoolRef.current) {
        mappingPoolRef.current.terminate();
      }
    };
  }, []);

  const [postDiffs, setPostDiffs] = useState<PostDiff[]>([]);
  const [overallMetrics, setOverallMetrics] =
    useState<ComparisonMetrics | null>(null);
  const [codeKappas, setCodeKappas] = useState<
    { code: string; kappa: number }[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingStep, setLoadingStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const similarityCache = useRef<Map<string, number>>(new Map());

  const getSimilarity = async (
    textA: string,
    textB: string
  ): Promise<number> => {
    if (textA === textB) return 1.0;
    const key = [textA, textB].sort().join("||");
    const cached = similarityCache.current.get(key);
    if (cached !== undefined) return cached;
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
    if (postIds.length === 0) {
      return [];
    }
    setLoadingStep("Fetching posts & comments");

    const NUM_CHUNKS = 4;
    const chunkSize = Math.ceil(postIds.length / NUM_CHUNKS);
    const chunks: string[][] = [];
    for (let i = 0; i < postIds.length; i += chunkSize) {
      chunks.push(postIds.slice(i, i + chunkSize));
    }

    const results = await Promise.all(
      chunks.map((chunk) =>
        workerPoolRef.current!.runTask<any[]>(
          {
            type: "fetchPostsAndCommentsBatch",
            datasetId: selectedWorkspaceId as string,
            postIds: chunk,
          },
          {
            responseType: "fetchPostsAndCommentsBatchResult",
            errorType: "error",
          }
        )
      )
    );

    const all = results.flat();
    const seen = new Set<string | number>();
    const deduped = all.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
    return deduped;
  };

  useEffect(() => {
    if (!isDatabaseLoaded) return;

    const fetchAndProcessData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        setLoadingStep("Fetching manual post IDs");
        const manualPostIdsQuery = await executeQuery(
          `SELECT state FROM state_dumps 
          WHERE json_extract(context, '$.function') = 'sample_posts'
          AND json_extract(context, '$.workspace_id') = ?`,
          [selectedWorkspaceId]
        );
        const manualPostIds: string[] = manualPostIdsQuery.flatMap(
          (row: any) => {
            try {
              const state = JSON.parse(row.state);
              return state.groups?.manual || [];
            } catch (e) {
              console.error("Failed to parse state JSON:", e);
              return [];
            }
          }
        );
        if (manualPostIds.length === 0) {
          throw new Error(
            "No manual post IDs found in state_dumps for sample_posts."
          );
        }
        console.log(`Number of manual post IDs: ${manualPostIds.length}`);

        setLoadingStep("Fetching state dumps");
        const rows: DatabaseRow[] = await executeQuery(
          `SELECT * FROM state_dumps
          WHERE json_extract(context, '$.function') IN ('generate_deductive_codes', 'dispatchManualCodingResponses')
          AND json_extract(context, '$.workspace_id') = ?
          ORDER BY created_at ASC`,
          [selectedWorkspaceId]
        );
        console.log(
          `Fetched ${rows.length} state dump rows for coding responses.`
        );

        setLoadingStep("Processing responses");
        const allResponses: CodingResult[] = [];
        for (const row of rows) {
          const state = JSON.parse(row.state);
          for (const resp of state.codebook || []) {
            if (manualPostIds.includes(resp.post_id)) {
              allResponses.push({
                id: resp.id,
                model: resp.model,
                quote: resp.quote,
                code: resp.code,
                explanation: resp.explanation,
                post_id: resp.post_id,
                chat_history: resp.chat_history
                  ? JSON.parse(resp.chat_history)
                  : null,
                is_marked:
                  resp.is_marked !== null ? Boolean(resp.is_marked) : null,
                range_marker: resp.range_marker
                  ? JSON.parse(resp.range_marker)
                  : null,
                response_type: resp.response_type,
              });
            }
          }
        }
        console.log(`Total coding responses: ${allResponses.length}`);

        const allPosts = await batchFetchPostsAndComments(manualPostIds);
        const postMap: Record<string, any> = {};
        allPosts.forEach((post) => {
          postMap[post.id] = post;
        });
        console.log(`Number of posts fetched: ${allPosts.length}`);

        const postGroups: Record<
          string,
          { human: CodingResult[]; llm: CodingResult[] }
        > = {};
        manualPostIds.forEach((postId) => {
          postGroups[postId] = { human: [], llm: [] };
        });
        allResponses.forEach((r) => {
          postGroups[r.post_id][
            r.response_type === "Human" ? "human" : "llm"
          ].push(r);
        });

        setLoadingStep("Generating code-to-quote maps");
        const codeToQuoteMaps: Record<
          string,
          {
            llmCodes: Record<string, string[]>;
            humanCodes: Record<string, string[]>;
            unmappedIds: string[];
          }
        > = {};
        await Promise.all(
          manualPostIds.map(async (postId, idx) => {
            const post = postMap[postId];
            const { human, llm } = postGroups[postId];
            const allCodes = [
              ...human.map((r) => ({
                id: r.id,
                text: r.quote,
                code: r.code,
                rangeMarker: r.range_marker,
                markedBy: "human",
              })),
              ...llm.map((r) => ({
                id: r.id,
                text: r.quote,
                code: r.code,
                rangeMarker: r.range_marker,
                markedBy: "llm",
              })),
            ];
            const map = await mappingPoolRef.current.runTask<{
              llmCodes: Record<string, string[]>;
              humanCodes: Record<string, string[]>;
              unmappedIds: string[];
            }>(
              {
                type: "getCodeToQuoteIds",
                post,
                id: idx.toString(),
                codes: allCodes,
              },
              {
                responseType: "getCodeToQuoteIdsResult",
                errorType: "error",
              }
            );
            console.log(`Post ${postId} mapping completed`, map, allCodes);
            codeToQuoteMaps[postId] = map;
          })
        );

        const codeIdToValue: Record<string, string> = {};
        allResponses.forEach((response) => {
          codeIdToValue[response.id] = response.code;
        });

        const allCodes = new Set<string>();
        const allQuoteIds = new Set<string>();
        for (const postId of manualPostIds) {
          const { llmCodes, humanCodes, unmappedIds } = codeToQuoteMaps[postId];
          unmappedIds.forEach((qId) => allQuoteIds.add(qId));
          Object.values(humanCodes)
            .flat()
            .forEach((qId) => allQuoteIds.add(qId));
          Object.values(llmCodes)
            .flat()
            .forEach((qId) => allQuoteIds.add(qId));

          for (const codeId in humanCodes) allCodes.add(codeIdToValue[codeId]);
          for (const codeId in llmCodes) allCodes.add(codeIdToValue[codeId]);
        }
        console.log(`Total unique quote IDs: ${allQuoteIds.size}`);

        const humanCodeValueToQuoteIds: Record<string, Set<string>> = {};
        const llmCodeValueToQuoteIds: Record<string, Set<string>> = {};
        for (const postId of manualPostIds) {
          const { llmCodes, humanCodes } = codeToQuoteMaps[postId];
          for (const codeId in humanCodes) {
            const codeValue = codeIdToValue[codeId];
            if (!humanCodeValueToQuoteIds[codeValue])
              humanCodeValueToQuoteIds[codeValue] = new Set();
            humanCodes[codeId].forEach((qId) =>
              humanCodeValueToQuoteIds[codeValue].add(qId)
            );
          }
          for (const codeId in llmCodes) {
            const codeValue = codeIdToValue[codeId];
            if (!llmCodeValueToQuoteIds[codeValue])
              llmCodeValueToQuoteIds[codeValue] = new Set();
            llmCodes[codeId].forEach((qId) =>
              llmCodeValueToQuoteIds[codeValue].add(qId)
            );
          }
        }

        const codeKappas: { code: string; kappa: number }[] = [];
        let sumA = 0;
        let sumB = 0;
        let sumC = 0;
        let sumD = 0;

        for (const codeValue of allCodes) {
          console.log(
            `Starting Cohen's Kappa calculation for code: ${codeValue}`
          );
          const humanSet = humanCodeValueToQuoteIds[codeValue] || new Set();
          const llmSet = llmCodeValueToQuoteIds[codeValue] || new Set();

          let a = 0; // Both applied the code
          let b = 0; // Human only applied the code
          let c = 0; // LLM only applied the code
          let d = 0; // Neither applied the code

          for (const quoteId of allQuoteIds) {
            const humanApplied = humanSet.has(quoteId);
            const llmApplied = llmSet.has(quoteId);
            if (humanApplied && llmApplied) a++;
            else if (humanApplied) b++;
            else if (llmApplied) c++;
            else d++;
          }

          sumA += a;
          sumB += b;
          sumC += c;
          sumD += d;

          const N = a + b + c + d;
          const p0 = (a + d) / N; // Observed agreement
          const pHumanYes = (a + b) / N;
          const pLLMYes = (a + c) / N;
          const pe = pHumanYes * pLLMYes + (1 - pHumanYes) * (1 - pLLMYes); // Expected agreement
          const kappa = pe < 1 ? (p0 - pe) / (1 - pe) : p0 === 1 ? 1 : 0;

          console.table({
            codeValue,
            overlap: a,
            "human Agree": b,
            "llm Agree": c,
            disagree: d,
            total: N,
            p0: p0,
            pe: pe,
            kappa: kappa,
          });

          codeKappas.push({ code: codeValue, kappa });
        }

        const averageKappa =
          codeKappas.reduce((sum, { kappa }) => sum + kappa, 0) /
          codeKappas.length;
        const totalN = allCodes.size * allQuoteIds.size;
        const percentageAgreement = totalN > 0 ? (sumA + sumD) / totalN : 0;

        setLoadingStep("Analyzing differences & metrics");
        let totalLlm = 0,
          markedLlm = 0,
          addedCorrect = 0;
        const diffs: PostDiff[] = [];

        for (const postId in postGroups) {
          const { human, llm } = postGroups[postId];
          totalLlm += llm.length;
          const humanTrue = human.filter((r) => r.is_marked);
          const llmTrue = llm.filter((r) => r.is_marked);
          const hSet = new Set(humanTrue.map((r) => r.quote));
          const lSet = new Set(llmTrue.map((r) => r.quote));

          markedLlm += llmTrue.length;
          for (const q of lSet) if (!hSet.has(q)) addedCorrect++;

          const allH = new Set(human.map((r) => r.quote));
          const allL = new Set(llm.map((r) => r.quote));
          const changes: ComparisonChange[] = [];

          for (const q of [...allH].filter((q) => allL.has(q))) {
            const hr = human.find((r) => r.quote === q)!;
            const lr = llm.find((r) => r.quote === q)!;
            if (hr.code !== lr.code) {
              const sim = await getSimilarity(hr.code, lr.code);
              changes.push({
                postId,
                quote: q,
                type: "same_quote_different_code",
                humanCode: hr.code,
                llmCode: lr.code,
                codeSimilarity: sim,
              });
            }
          }
          diffs.push({ postId, changes });
        }

        const llmAcceptanceRate = totalLlm ? markedLlm / totalLlm : 0;

        setOverallMetrics({
          llmAcceptanceRate,
          llmAddedCorrect: addedCorrect,
          humanNotInLlmCorrect: sumB,
          matchingQuotes: sumA,
          percentageAgreement,
          cohenKappa: averageKappa,
        });
        setPostDiffs(diffs);
        setCodeKappas(codeKappas);
      } catch (err) {
        console.error(err);
        setError("An error occurred while processing data.");
      } finally {
        setIsLoading(false);
        setLoadingStep(null);
      }
    };

    fetchAndProcessData();
  }, [
    isDatabaseLoaded,
    executeQuery,
    calculateSimilarity,
    selectedWorkspaceId,
  ]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-100 bg-opacity-75">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-500 mx-auto" />
          <p className="mt-4 text-lg font-semibold text-gray-700">
            Loading data…
          </p>
          {loadingStep && (
            <p className="mt-2 text-base text-gray-600">{loadingStep}</p>
          )}
        </div>
      </div>
    );
  }
  if (error) {
    return <p className="p-4 text-red-600">{error}</p>;
  }
  if (!isDatabaseLoaded) {
    return (
      <p className="p-4 text-gray-600">Please select and load a database.</p>
    );
  }

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">
        Human vs LLM Coding Comparison
      </h1>
      {overallMetrics && (
        <div className="mb-8 p-4 bg-gray-50 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-2">Overall Metrics</h2>
          <ul className="list-disc pl-5">
            <li>
              <strong>LLM Acceptance Rate:</strong>{" "}
              {overallMetrics.llmAcceptanceRate.toFixed(3)}
            </li>
            <li>
              <strong>LLM Added Correct:</strong>{" "}
              {overallMetrics.llmAddedCorrect}
            </li>
            <li>
              <strong>Human Not In LLM Correct:</strong>{" "}
              {overallMetrics.humanNotInLlmCorrect}
            </li>
            <li>
              <strong>Matching Quotes:</strong> {overallMetrics.matchingQuotes}
            </li>
            <li>
              <strong>Percentage Agreement:</strong>{" "}
              {overallMetrics.percentageAgreement.toFixed(3)}
            </li>
            <li>
              <strong>Average Cohen’s Kappa:</strong>{" "}
              {overallMetrics.cohenKappa.toFixed(3)}
            </li>
          </ul>
        </div>
      )}
      {codeKappas.length > 0 && (
        <div className="mb-8 p-4 bg-gray-50 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-2">Per-Code Cohen’s Kappa</h2>
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left">Code</th>
                <th className="text-left">Kappa</th>
              </tr>
            </thead>
            <tbody>
              {codeKappas.map(({ code, kappa }) => (
                <tr key={code}>
                  <td>{code}</td>
                  <td>{kappa.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {postDiffs.map(({ postId, changes }) => (
        <div key={postId} className="mb-8 p-4 bg-white rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-2">Post ID: {postId}</h2>
          {changes.length === 0 ? (
            <p className="text-gray-600">No differences found.</p>
          ) : (
            <div className="space-y-4">
              {changes.map((chg, i) => (
                <div key={i} className="p-3 bg-gray-100 rounded">
                  <p>
                    <strong>Type:</strong> {chg.type}
                  </p>
                  <p>
                    <strong>Quote:</strong> {chg.quote}
                  </p>
                  {chg.type === "same_quote_different_code" && (
                    <>
                      <p>
                        <strong>Human Code:</strong> {chg.humanCode}
                      </p>
                      <p>
                        <strong>LLM Code:</strong> {chg.llmCode}
                      </p>
                      <p>
                        <strong>Similarity:</strong>{" "}
                        {chg.codeSimilarity?.toFixed(3)}
                      </p>
                    </>
                  )}
                  {chg.type === "human_only" && (
                    <p>
                      <strong>Human Code:</strong> {chg.humanCode}
                    </p>
                  )}
                  {chg.type === "llm_only" && (
                    <p>
                      <strong>LLM Code:</strong> {chg.llmCode}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default ManualCodingComparisonViewer;

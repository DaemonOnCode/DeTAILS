import { ratio } from "fuzzball";

function displayText(text) {
  return text.replace(/\s+/g, " ").trim();
}

function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s]|_/g, "")
    .trim();
}

function traverseComments(comment, parentId) {
  return [
    {
      id: comment.id,
      text: displayText(comment.body),
      type: "comment",
      parent_id: parentId,
    },
    ...(comment.comments || []).flatMap((c) => traverseComments(c, comment.id)),
  ];
}

function getQuoteParentId(element) {
  switch (element.type) {
    case "title":
      return `${element.id}-title`;
    case "selftext":
      return `${element.id}-selftext`;
    case "comment":
      return element.id;
    default:
      throw new Error(`Unknown type: ${element.type}`);
  }
}

function getCodeToQuoteMap(post, codes) {
  console.log("DEBUG getCodeToQuoteMap called", {
    post,
    codes,
  });
  const transcriptFlatMap = [
    {
      id: post.id,
      text: displayText(post.title),
      type: "title",
      parent_id: null,
    },
    {
      id: post.id,
      text: displayText(post.selftext),
      type: "selftext",
      parent_id: null,
    },
    ...post.comments.flatMap((comment) => traverseComments(comment, post.id)),
  ];

  const allQuoteParentIds = new Set(transcriptFlatMap.map(getQuoteParentId));

  const llmCodesMap = {};
  const humanCodesMap = {};
  const mappedQuoteParentIds = new Set();

  codes.forEach((code) => {
    const targetMap = code.markedBy === "llm" ? llmCodesMap : humanCodesMap;
    const quoteParentIds = new Set();

    if (code.rangeMarker) {
      const dataIndex = parseInt(code.rangeMarker.itemId);
      if (dataIndex >= 0 && dataIndex < transcriptFlatMap.length) {
        const element = transcriptFlatMap[dataIndex];
        const quoteParentId = getQuoteParentId(element);
        quoteParentIds.add(quoteParentId);
      }
    } else {
      transcriptFlatMap.forEach((element) => {
        const elementText = normalizeText(element.text);
        const codeText = normalizeText(code.text);
        const exactMatch = element.text.includes(code.text);
        const fuzzyScore = exactMatch
          ? 100
          : ratio(elementText, codeText, { full_process: true });
        if (fuzzyScore >= 85) {
          const quoteParentId = getQuoteParentId(element);
          quoteParentIds.add(quoteParentId);
        }
      });
    }

    targetMap[code.id] = Array.from(quoteParentIds);
    quoteParentIds.forEach((id) => mappedQuoteParentIds.add(id));
  });

  const unmappedIds = Array.from(allQuoteParentIds).filter(
    (id) => !mappedQuoteParentIds.has(id)
  );

  console.log("DEBUG unmappedIds:", unmappedIds);

  return {
    llmCodes: llmCodesMap,
    humanCodes: humanCodesMap,
    unmappedIds: unmappedIds,
  };
}

onmessage = (event) => {
  const { type, id, post, codes } = event.data;
  console.log("DEBUG transcript-worker received message:", event.data);
  if (type === "getCodeToQuoteParentIds") {
    try {
      console.log("DEBUG getCodeToQuoteParentIds called", {
        post,
        codes,
      });
      const result = getCodeToQuoteMap(post, codes);
      postMessage({ type: "getCodeToQuoteParentIdsResult", id, data: result });
    } catch (error) {
      postMessage({ type: "error", id, data: error.message });
    }
  }
};

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

function getQuoteId(element) {
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

  const allQuoteIds = transcriptFlatMap.map(getQuoteId);
  const codeToQuoteIds = {};

  codes.forEach((code) => {
    const quoteIds = new Set();
    if (code.rangeMarker) {
      const dataIndex = parseInt(code.rangeMarker.itemId);
      if (dataIndex >= 0 && dataIndex < transcriptFlatMap.length) {
        const element = transcriptFlatMap[dataIndex];
        const quoteId = getQuoteId(element);
        quoteIds.add(quoteId);
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
          const quoteId = getQuoteId(element);
          quoteIds.add(quoteId);
        }
      });
    }
    codeToQuoteIds[code.id] = Array.from(quoteIds);
  });

  return { codeToQuoteIds, allQuoteIds };
}

onmessage = (event) => {
  const { type, id, post, codes } = event.data;
  if (type === "getCodeToQuoteIds") {
    try {
      const result = getCodeToQuoteMap(post, codes);
      postMessage({ type: "getCodeToQuoteIdsResult", id, data: result });
    } catch (error) {
      postMessage({ type: "error", id, data: error.message });
    }
  }
};

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

  const allQuoteIds = Array.from(new Set(transcriptFlatMap.map(getQuoteId)));
  const codeToQuoteIds = {};

  codes.forEach((code) => {
    codeToQuoteIds[code.id] = new Set();
  });

  transcriptFlatMap.forEach((data, index) => {
    const quoteId = getQuoteId(data);

    codes.forEach((code) => {
      let isMatch = false;

      if (code.rangeMarker && code.rangeMarker.itemId === String(index)) {
        isMatch = true;
      } else if (code.source) {
        try {
          const src = JSON.parse(code.source);
          if (
            src.type === "comment" &&
            data.type === "comment" &&
            data.id === src.comment_id
          ) {
            isMatch = true;
          } else if (src.type === "post") {
            if (src.title && data.type === "title") isMatch = true;
            else if (!src.title && data.type === "selftext") isMatch = true;
          }
        } catch {
          console.error("Error parsing source metadata:", code.source);
        }
      } else {
        const normText = normalizeText(data.text);
        const normCodeText = normalizeText(code.text);
        const exactMatch = data.text.includes(code.text);
        const fuzzyScore = exactMatch
          ? 100
          : ratio(normText, normCodeText, { full_process: true });
        if (fuzzyScore >= 85) isMatch = true;
      }

      if (isMatch) {
        codeToQuoteIds[code.id].add(quoteId);
      }
    });
  });
  Object.keys(codeToQuoteIds).forEach((codeId) => {
    codeToQuoteIds[codeId] = Array.from(codeToQuoteIds[codeId]);
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

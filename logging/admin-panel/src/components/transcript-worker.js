import { ratio } from "fuzzball";

function displayText(text) {
  const result = text.replace(/\s+/g, " ").trim();
  console.log(`displayText: Input "${text}" -> Output "${result}"`);
  return result;
}

function normalizeText(text) {
  const result = text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s]|_/g, "")
    .trim();
  console.log(`normalizeText: Input "${text}" -> Output "${result}"`);
  return result;
}

function traverseComments(comment, parentId) {
  console.log(
    `traverseComments: Processing comment ID ${comment.id} with parent ID ${parentId}`
  );
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
  console.log(
    `getQuoteParentId: Processing element type "${element.type}" with ID "${element.id}"`
  );
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

function getCodeToQuoteParentIds(post, codes) {
  console.log(
    `getCodeToQuoteParentIds: Starting for post ID "${post.id}" with ${codes.length} codes`
  );
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
  console.log(
    `transcriptFlatMap created with ${transcriptFlatMap.length} elements`
  );

  const codeToQuoteParentIds = {};
  const uniqueCodes = Array.from(new Set(codes.map((c) => c.code)));
  uniqueCodes.forEach((code) => {
    codeToQuoteParentIds[code] = new Set();
  });
  console.log(
    `Initialized codeToQuoteParentIds with ${uniqueCodes.length} unique codes`
  );

  codes
    .filter((c) => c.rangeMarker)
    .forEach((code) => {
      const dataIndex = parseInt(code.rangeMarker.itemId);
      console.log(
        `Processing code "${code.code}" with rangeMarker, itemId: ${code.rangeMarker.itemId}, parsed index: ${dataIndex}`
      );
      if (dataIndex >= 0 && dataIndex < transcriptFlatMap.length) {
        const element = transcriptFlatMap[dataIndex];
        const quoteParentId = getQuoteParentId(element);
        codeToQuoteParentIds[code.code].add(quoteParentId);
        console.log(
          `Added quoteParentId "${quoteParentId}" to code "${code.code}"`
        );
      } else {
        console.warn(`Invalid dataIndex ${dataIndex} for code "${code.code}"`);
      }
    });

  const codesWithoutMarker = codes.filter((c) => !c.rangeMarker);
  console.log(
    `Processing ${codesWithoutMarker.length} codes without rangeMarker`
  );
  transcriptFlatMap.forEach((element) => {
    const elementText = normalizeText(element.text);
    codesWithoutMarker.forEach((code) => {
      const codeText = normalizeText(code.text);
      const exactMatch = element.text.includes(code.text);
      const fuzzyScore = exactMatch
        ? 100
        : ratio(elementText, codeText, { full_process: true });
      console.log(
        `Comparing element ID "${element.id}" (type: ${element.type}) with code "${code.code}": exactMatch=${exactMatch}, fuzzyScore=${fuzzyScore}`
      );
      if (fuzzyScore >= 85) {
        const quoteParentId = getQuoteParentId(element);
        codeToQuoteParentIds[code.code].add(quoteParentId);
        console.log(
          `Matched quoteParentId "${quoteParentId}" to code "${code.code}" with score ${fuzzyScore}`
        );
      }
    });
  });

  const result = {};
  for (const code in codeToQuoteParentIds) {
    result[code] = Array.from(codeToQuoteParentIds[code]);
  }
  console.log(`Final result for post ID "${post.id}":`, result);
  return result;
}

onmessage = (event) => {
  const { type, id, post, codes } = event.data;
  console.log(`onmessage: Received event type "${type}"`);
  if (type === "getCodeToQuoteParentIds") {
    try {
      console.log(
        `Processing request for post ID "${post.id}" with ${codes.length} codes`
      );
      const result = getCodeToQuoteParentIds(post, codes);
      postMessage({ type: "getCodeToQuoteParentIdsResult", id, data: result });
      console.log(`Sent result for post ID "${post.id}"`);
    } catch (error) {
      console.error(
        `Error processing post ID "${data?.post?.id}": ${error.message}`
      );
      postMessage({ type: "error", id, data: err.message });
    }
  }
};

import EntriesViewer from "./entries-viewer";

function KeywordCloud() {
  const getComparisonData = (state: any) => {
    const arr =
      state["keywords"] ?? state["coding_context"]?.["keywords"] ?? [];
    if (!Array.isArray(arr)) return {};
    // Transform array into an object with 'id' as keys
    return Object.fromEntries(
      arr
        .filter((item) => item && typeof item === "object" && "id" in item) // Filter valid objects with 'id'
        .map((item) => [item.id, item]) // Map to [id, object] pairs
    );
  };
  return (
    <EntriesViewer
      title="Keyword Cloud Entries and Differences"
      functionName="keyword_cloud_table"
      getComparisonData={getComparisonData}
      includeRun={false}
    />
  );
}

export default KeywordCloud;

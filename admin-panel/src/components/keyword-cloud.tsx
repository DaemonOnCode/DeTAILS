import EntriesViewer from "./entries-viewer";

function KeywordCloud() {
  const getComparisonData = (state: any) =>
    state["keywords"] ?? state["coding_context"]?.["keywords"];
  return (
    <EntriesViewer
      title="Keyword Cloud Entries and Differences"
      functionName="keyword_table"
      getComparisonData={getComparisonData}
      includeRun={false}
    />
  );
}

export default KeywordCloud;

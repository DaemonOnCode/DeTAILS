import EntriesViewer from "./entries-viewer";

function KeywordTable() {
  const getComparisonData = (state: any) =>
    state["results"] ?? state["coding_context"]?.["keyword_table"];
  return (
    <EntriesViewer
      title="Keyword Table Entries and Differences"
      functionName="keyword_cloud_table"
      getComparisonData={getComparisonData}
      includeRun={false}
    />
  );
}

export default KeywordTable;

import EntriesViewer from "./entries-viewer";

function FinalizingCodes() {
  const getComparisonData = (state: any) =>
    state["higher_level_codes"]?.map((gc: any) => gc.name) ??
    state["coding_context"]?.["grouped_codes"].map((gc: any) => gc.name);
  return (
    <EntriesViewer
      title="Finalizing Codes Entries and Differences"
      functionName="code_grouping"
      getComparisonData={getComparisonData}
      includeRun={true}
    />
  );
}

export default FinalizingCodes;

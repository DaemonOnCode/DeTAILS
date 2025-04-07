import EntriesViewer from "./entries-viewer";

function Themes() {
  const getComparisonData = (state: any) =>
    state["themes"]?.map((theme: any) => theme.theme) ??
    state["coding_context"]?.["themes"].map((theme: any) => theme.name);
  return (
    <EntriesViewer
      title="Themes Entries and Differences"
      functionName="theme_generation"
      getComparisonData={getComparisonData}
      includeRun={true}
    />
  );
}

export default Themes;

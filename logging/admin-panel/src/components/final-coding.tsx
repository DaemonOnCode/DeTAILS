import EntriesViewer from "./entries-viewer";

function FinalCoding() {
  const getComparisonData = (state: any) => {
    const arr =
      state["results"] ??
      state["coding_context"]?.["unseen_post_response"] ??
      [];

    if (!Array.isArray(arr)) return {};

    return Object.fromEntries(
      arr
        .filter((item) => item && typeof item === "object" && "id" in item) // Filter valid objects with 'id'
        .map((item) => [item.id, item])
    );
  };
  return (
    <EntriesViewer
      title="Final Coding Entries and Differences"
      functionName="final_codes"
      getComparisonData={getComparisonData}
      includeRun={true}
    />
  );
}

export default FinalCoding;

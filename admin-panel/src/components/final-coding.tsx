import EntriesViewer from "./entries-viewer";

function FinalCoding() {
  const getComparisonData = (state: any) => {
    // Extract the array from state: either 'results' or 'unseen_post_responses'
    const arr =
      state["results"] ??
      state["coding_context"]?.["unseen_post_response"] ??
      [];
    // Ensure the input is an array; return empty object if not
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
      title="Final Coding Entries and Differences"
      functionName="deductive_codes"
      getComparisonData={getComparisonData}
      includeRun={true}
    />
  );
}

export default FinalCoding;

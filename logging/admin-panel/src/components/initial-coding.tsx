import EntriesViewer from "./entries-viewer";

function InitialCoding() {
  const getComparisonData = (state: any) => {
    // Extract the array from state: either 'results' or 'unseen_post_responses'
    const arr =
      state["results"] ??
      state["coding_context"]?.["sampled_post_responses"] ??
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
      title="Initial Coding Entries and Differences"
      functionName="initial_codes"
      getComparisonData={getComparisonData}
      includeRun={true}
    />
  );
}

export default InitialCoding;

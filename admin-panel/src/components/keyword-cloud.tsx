import { useDatabase } from "./database-context";

function KeywordCloud() {
  const { isDatabaseLoaded } = useDatabase();
  if (!isDatabaseLoaded) {
    return <p className="p-4">Please select a database first.</p>;
  }
  return <div className="p-4">KeywordCloud page content goes here</div>;
}

export default KeywordCloud;

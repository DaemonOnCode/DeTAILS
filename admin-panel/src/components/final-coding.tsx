import { useDatabase } from "./database-context";

function FinalCoding() {
  const { isDatabaseLoaded } = useDatabase();
  if (!isDatabaseLoaded) {
    return <p className="p-4">Please select a database first.</p>;
  }
  return <div className="p-4">FinalCoding page content goes here</div>;
}

export default FinalCoding;

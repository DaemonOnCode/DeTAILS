import { useDatabase } from "./database-context";

function Themes() {
  const { isDatabaseLoaded } = useDatabase();
  if (!isDatabaseLoaded) {
    return <p className="p-4">Please select a database first.</p>;
  }
  return <div className="p-4">Themes page content goes here</div>;
}

export default Themes;

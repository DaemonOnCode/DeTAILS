import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import { DatabaseProvider } from "./components/database-context";
import NavBar from "./components/navbar";
import SelectDBFile from "./components/select-db-file";
import FinalCoding from "./components/final-coding";
import FinalizingCodes from "./components/finalizing-codes";
import InitialCoding from "./components/initial-coding";
import KeywordCloud from "./components/keyword-cloud";
import KeywordTable from "./components/keyword-table";
import Themes from "./components/themes";
import Timeline from "./components/timeline";

function App() {
  return (
    <Router>
      <DatabaseProvider>
        <NavBar />
        <Routes>
          <Route path="/select-db-file" element={<SelectDBFile />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/keyword-cloud" element={<KeywordCloud />} />
          <Route path="/keyword-table" element={<KeywordTable />} />
          <Route path="/initial-coding" element={<InitialCoding />} />
          <Route path="/final-coding" element={<FinalCoding />} />
          <Route path="/finalizing-codes" element={<FinalizingCodes />} />
          <Route path="/themes" element={<Themes />} />
          <Route path="/" element={<SelectDBFile />} />
        </Routes>
      </DatabaseProvider>
    </Router>
  );
}

export default App;

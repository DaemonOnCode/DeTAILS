import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import { DatabaseProvider } from "./components/context";
import NavBar from "./components/navbar";
import SelectDBFile from "./components/upload-file";
import FinalCoding from "./components/final-coding";
import FinalizingCodes from "./components/finalizing-codes";
import InitialCoding from "./components/initial-coding";
import RelatedConcepts from "./components/relevant-concepts";
import ConceptOutline from "./components/concept-outline";
import Themes from "./components/themes";
import Timeline from "./components/timeline";
import ErrorRates from "./components/error-rates";
import ManualCoding from "./components/manual-coding";
import InitialCodebook from "./components/initial-codebook";
import GlobalCoding from "./components/global-coding";

function App() {
  return (
    <Router>
      <DatabaseProvider>
        <NavBar />
        <Routes>
          <Route path="/select-db-file" element={<SelectDBFile />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/related-concepts" element={<RelatedConcepts />} />
          <Route path="/concept-outline" element={<ConceptOutline />} />
          <Route path="/initial-coding" element={<InitialCoding />} />
          <Route path="/final-coding" element={<FinalCoding />} />
          <Route path="/finalizing-codes" element={<FinalizingCodes />} />
          <Route path="/themes" element={<Themes />} />
          <Route path="/error-rates" element={<ErrorRates />} />
          <Route path="/manual-coding" element={<ManualCoding />} />
          <Route path="/initial-codebook" element={<InitialCodebook />} />
          <Route path="/global-coding" element={<GlobalCoding />} />
          <Route path="/" element={<SelectDBFile />} />
        </Routes>
      </DatabaseProvider>
    </Router>
  );
}

export default App;

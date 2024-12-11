import { useState, useEffect } from "react";
import axios from "axios";
import RulesTable from "../../components/DataCleaning/rules_table";
import WordPanel from "../../components/DataCleaning/word_panel";
import { Rule } from "../../types/DataCleaning/shared";
import CreateRuleModal from "../../components/DataCleaning/rule_modal";

const HomePage = () => {
  const [rules, setRules] = useState<Rule[]>([]);
  const [tokenizer, setTokenizer] = useState("spacy 3.7.2 en_core_web_sm 3.7.1");
  const [method, setMethod] = useState("Lemmatizer: spacy en_core_web_sm");
  const [includedWords, setIncludedWords] = useState([]);
  const [removedWords, setRemovedWords] = useState([]);

    const tryRequest = async (promise: Promise<any>) => {
        try {
            const response = await promise;
            return response.data;
        } catch (error) {
            console.error(error);
            return [];
        }
    }

  // Load rules from backend
  useEffect(() => {
    // tryRequest(axios.get("http://127.0.0.1:6000/api/data-filtering/datasets/1/rules").then((response) => {
    //   setRules(response.data);
    // }));
  }, []);

  const addRule = (newRule: Rule) => {
    setRules([...rules, newRule]);

    // Send to backend
    // tryRequest(axios.post("http://127.0.0.1:6000/api/data-filtering/datasets/1/rules", { rules: [...rules, newRule] }));
  };

  const deleteRule = (ruleId :number | null, deleteAll = false) => {
    const updatedRules = deleteAll ? [] : rules.filter((rule) => rule.id !== ruleId);
    setRules(updatedRules);

    // Update backend
    // tryRequest(axios.post("http://127.0.0.1:6000/api/data-filtering/datasets/1/rules", { rules: updatedRules }));
  };

  const [isModalOpen, setModalOpen] = useState(false);

    const handleOpenModal = () => setModalOpen(true);
    const handleCloseModal = () => setModalOpen(false);

  return (
    <div className="flex h-full gap-x-2 bg-gray-100">
      {/* Left Panel */}
      <div className="flex flex-col w-1/2 border-r border-gray-300">
        <div className="bg-white p-4 shadow-sm mb-4">
          <h2 className="text-lg font-bold mb-2">Rules List</h2>
          <p className="text-sm text-gray-600 mb-2">Tokenizer: {tokenizer}</p>

          {/* Method Dropdown */}
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm mb-4"
          >
            <option value="Lemmatizer: spacy en_core_web_sm">Lemmatizer: spacy en_core_web_sm</option>
            <option value="Other Method">Other Method</option>
          </select>

          <div className="flex items-center gap-4">
            <button className="bg-blue-500 text-white px-4 py-2 text-sm rounded hover:bg-blue-600">
              Pause Auto-Apply
            </button>
            <button
              onClick={handleOpenModal}
              className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded text-sm"
            >
              Create Rule
            </button>
            <button
              onClick={() => deleteRule(null, true)}
              className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded text-sm"
            >
              Delete All Rules
            </button>
          </div>
        </div>

        <div className="flex-grow bg-white shadow-sm p-4 rounded">
          <div className="h-full overflow-y-auto">
            <RulesTable rules={rules} deleteRule={deleteRule} 
            addRule={addRule} />
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex flex-col w-1/2">
        <div className="flex-1 p-2 bg-white shadow-sm mb-2">
          <h3 className="text-md font-bold mb-1">Included List</h3>
          <WordPanel title="Included List" words={includedWords} />
        </div>
        <div className="flex-1 p-2 bg-white shadow-sm">
          <h3 className="text-md font-bold mb-1">Removed List</h3>
          <WordPanel title="Removed List" words={removedWords} />
        </div>
      </div>
            <CreateRuleModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSave={addRule}
            />
    </div>
  );
};

export default HomePage;

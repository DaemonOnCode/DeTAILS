import { useState, useEffect } from "react";
import axios from "axios";
import RulesTable from "../../components/DataCleaning/rules_table";
import WordPanel from "../../components/DataCleaning/word_panel";
import { Rule } from "../../types/DataCleaning/shared";
import CreateRuleModal from "../../components/DataCleaning/rule_modal";
import { REMOTE_SERVER_BASE_URL } from "../../constants/Shared";
import { useCollectionContext } from "../../context/collection_context";

const tryRequest = async (promise: Promise<any>) => {
  try {
    const response = await promise;
    return response.data;
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
};

const HomePage = () => {
  const [rules, setRules] = useState<Rule[]>([]);
  const [tokenizer, setTokenizer] = useState("spacy 3.7.2 en_core_web_sm 3.7.1");
  const [method, setMethod] = useState("Lemmatizer: spacy en_core_web_sm");
  const [includedWords, setIncludedWords] = useState<string[]>([]);
  const [removedWords, setRemovedWords] = useState<string[]>([]);
  const [isModalOpen, setModalOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processedPosts, setProcessedPosts] = useState<any[]>([]);
  const [processedComments, setProcessedComments] = useState<any[]>([]);

  const { datasetId} = useCollectionContext();

  // Fetch rules from the backend
  const fetchRules = async () => {
    const data = await tryRequest(
      axios.get(`${REMOTE_SERVER_BASE_URL}/data-filtering/datasets/${datasetId}/rules`)
    );
    setRules(data);
  };

  // Fetch processed data
  const fetchProcessedData = async () => {
    try {
      const posts = await tryRequest(
        axios.get(`${REMOTE_SERVER_BASE_URL}/data-filtering/processed-posts/${datasetId}`)
      );
      const comments = await tryRequest(
        axios.get(`${REMOTE_SERVER_BASE_URL}/data-filtering/processed-comments/${datasetId}`)
      );
      setProcessedPosts(posts.posts);
      setProcessedComments(comments.comments);
    } catch (error) {
      console.error("Error fetching processed data:", error);
    }
  };

  // Apply rules and create backups
  const applyRules = async () => {
    setProcessing(true);
    try {
      await tryRequest(
        axios.post(`${REMOTE_SERVER_BASE_URL}/data-filtering/apply-rules-to-dataset`, { dataset_id: datasetId })
      );
      alert("Rules applied and backups created successfully!");
      await fetchProcessedData(); // Refresh processed data
    } catch (error) {
      console.error("Error applying rules:", error);
      alert("Failed to apply rules.");
    }
    setProcessing(false);
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const addRule = async (newRule: Rule) => {
    const updatedRules = [...rules, { ...newRule, id: rules.length + 1 }];

    // Update state and backend
    setRules(updatedRules);
    await tryRequest(
      axios.post(`${REMOTE_SERVER_BASE_URL}/data-filtering/datasets/${datasetId}/rules`, {
        rules: updatedRules,
      })
    );
  };

  const deleteRule = async (ruleId: number | null, deleteAll = false) => {
    const updatedRules = deleteAll
      ? []
      : rules.filter((rule) => rule.id !== ruleId);

    // Update state and backend
    setRules(updatedRules);
    if (deleteAll) {
      await tryRequest(
        axios.delete(`${REMOTE_SERVER_BASE_URL}/data-filtering/datasets/${datasetId}/rules`)
      );
    } else {
      await tryRequest(
        axios.post(`${REMOTE_SERVER_BASE_URL}/data-filtering/datasets/${datasetId}/rules`, {
          rules: updatedRules,
        })
      );
    }
  };

  const reorderRules = async (updatedRules: Rule[]) => {
    // Update state and backend
    setRules(updatedRules);
    await tryRequest(
      axios.post(`${REMOTE_SERVER_BASE_URL}/data-filtering/datasets/${datasetId}/rules`, {
        rules: updatedRules,
      })
    );
  };

  const moveWordToIncluded = (word: string) => {
    setRemovedWords(removedWords.filter((w) => w !== word));
    setIncludedWords([...includedWords, word]);
  };

  const moveWordToRemoved = (word: string) => {
    setIncludedWords(includedWords.filter((w) => w !== word));
    setRemovedWords([...removedWords, word]);
  };

  const handleOpenModal = () => setModalOpen(true);
  const handleCloseModal = () => setModalOpen(false);

  return (
    <div className="flex flex-col gap-y-4 h-full bg-gray-100">
      <div className="flex flex-row gap-x-4">
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
              <option value="Lemmatizer: spacy en_core_web_sm">
                Lemmatizer: spacy en_core_web_sm
              </option>
              <option value="Other Method">Other Method</option>
            </select>

            <div className="flex items-center gap-4">
              <button
                className="bg-blue-500 text-white px-4 py-2 text-sm rounded hover:bg-blue-600"
                onClick={applyRules}
                disabled={processing}
              >
                {processing ? "Processing..." : "Apply Rules"}
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
              <RulesTable
                rules={rules}
                deleteRule={deleteRule}
                reorderRules={reorderRules}
                addRule={addRule}
              />
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div className="flex flex-col w-1/2">
          <div className="flex-1 p-2 bg-white shadow-sm mb-2">
            <h3 className="text-md font-bold mb-1">Included List</h3>
            <WordPanel
              title="Included List"
              words={includedWords}
              onDropWord={moveWordToIncluded}
            />
          </div>
          <div className="flex-1 p-2 bg-white shadow-sm">
            <h3 className="text-md font-bold mb-1">Removed List</h3>
            <WordPanel
              title="Removed List"
              words={removedWords}
              onDropWord={moveWordToRemoved}
            />
          </div>
        </div>
      </div>

      {/* Processed Data Panel */}
      <div className="bg-white shadow-sm p-4 rounded">
        <h3 className="text-lg font-bold mb-2">Processed Data</h3>
        <div className="space-y-4">
          <h4 className="text-md font-semibold">Posts</h4>
          <div className="space-y-2">
            {processedPosts.map((post) => (
              <div key={post.id} className="p-2 bg-gray-100 rounded">
                <strong>{post.title}</strong>
                <p>{post.selftext}</p>
              </div>
            ))}
          </div>
          <h4 className="text-md font-semibold">Comments</h4>
          <div className="space-y-2">
            {processedComments.map((comment) => (
              <div key={comment.id} className="p-2 bg-gray-100 rounded">
                {comment.body}
              </div>
            ))}
          </div>
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

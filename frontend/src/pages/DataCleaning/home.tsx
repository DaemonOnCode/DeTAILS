import { useState, useEffect, useRef } from 'react';
import RulesTable from '../../components/DataCleaning/rules-table';
import WordPanel, { WordDetail } from '../../components/DataCleaning/word-panel';
import CreateRuleModal from '../../components/DataCleaning/rule-modal';
import { Rule } from '../../types/DataCleaning/shared';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import { useApi } from '../../hooks/Shared/use-api';
import { useWorkspaceContext } from '../../context/workspace-context';

const HomePage = () => {
    const [rules, setRules] = useState<Rule[]>([]);
    const [tokenizer, setTokenizer] = useState('spacy 3.7.2 en_core_web_sm 3.7.1');
    const [method, setMethod] = useState('Lemmatizer: spacy en_core_web_sm');
    const [includedWords, setIncludedWords] = useState<WordDetail[]>([]);
    const [removedWords, setRemovedWords] = useState<WordDetail[]>([]);
    const [isModalOpen, setModalOpen] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [processsedPosts, setProcessedPosts] = useState<WordDetail[]>([]);
    const [processsedComments, setProcessedComments] = useState<WordDetail[]>([]);
    const [stats, setStats] = useState({
        totalDocs: 0,
        totalTokens: 0,
        uniqueTokens: 0
    });

    const { currentWorkspace } = useWorkspaceContext();
    const { saveWorkspaceData } = useWorkspaceUtils();
    const hasSavedRef = useRef(false);

    const { fetchData } = useApi();

    // Fetch rules using fetchData
    const fetchRules = async () => {
        try {
            const { data, error } = await fetchData<Rule[]>('data-filtering/datasets/rules', {
                method: 'POST',

                body: JSON.stringify({ workspace_id: currentWorkspace.id })
            });
            if (error) {
                console.error('Error fetching rules:', error);
                return;
            }
            setRules(data);
        } catch (err) {
            console.error(err);
        }
    };

    // Fetch processed data (posts, comments, included words, removed words)
    const fetchProcessedData = async () => {
        try {
            const [postsResponse, commentsResponse, includedWordsResponse, removedWordsResponse] =
                await Promise.all([
                    fetchData<any>('data-filtering/datasets/processed-posts', {
                        method: 'POST',

                        body: JSON.stringify({ workspace_id: currentWorkspace.id })
                    }),
                    fetchData<any>('data-filtering/datasets/processed-comments', {
                        method: 'POST',

                        body: JSON.stringify({ workspace_id: currentWorkspace.id })
                    }),
                    fetchData<any>('data-filtering/datasets/included-words', {
                        method: 'POST',

                        body: JSON.stringify({ workspace_id: currentWorkspace.id })
                    }),
                    fetchData<any>('data-filtering/datasets/removed-words', {
                        method: 'POST',

                        body: JSON.stringify({ workspace_id: currentWorkspace.id })
                    })
                ]);

            // Assuming the responses are successful. You can check for error on each if needed.
            setProcessedPosts(postsResponse.data.posts);
            setProcessedComments(commentsResponse.data.comments);

            const totalTokens =
                includedWordsResponse.data.words.reduce(
                    (acc: number, word: any) => acc + word.count_words,
                    0
                ) +
                removedWordsResponse.data.words.reduce(
                    (acc: number, word: any) => acc + word.count_words,
                    0
                );
            const uniqueTokens =
                includedWordsResponse.data.words.length + removedWordsResponse.data.words.length;

            setStats({
                totalDocs: postsResponse.data + commentsResponse.data, // Adjust if needed
                totalTokens,
                uniqueTokens
            });

            setIncludedWords(includedWordsResponse.data.words);
            setRemovedWords(removedWordsResponse.data.words);
        } catch (err) {
            console.error(err);
        }
    };

    // Apply rules using fetchData
    const applyRules = async () => {
        setProcessing(true);
        try {
            const { error } = await fetchData('data-filtering/datasets/apply-rules', {
                method: 'POST',
                body: JSON.stringify({
                    workspace_id: currentWorkspace.id,
                    rules
                })
            });
            if (error) {
                console.error('Error applying rules:', error);
            } else {
                await fetchProcessedData();
            }
        } catch (err) {
            console.error(err);
        }
        setProcessing(false);
    };

    // Add a new rule using fetchData
    const addRule = async (newRule: Rule) => {
        try {
            const updatedRules = [...rules, { ...newRule, id: rules.length + 1 }];
            setRules(updatedRules);

            const { error } = await fetchData('data-filtering/datasets/add-rules', {
                method: 'POST',
                body: JSON.stringify({
                    workspace_id: currentWorkspace.id,
                    rules: updatedRules
                })
            });
            if (error) {
                console.error('Error adding rule:', error);
            }
        } catch (err) {
            console.error(err);
        }
    };

    // Delete rule(s) using fetchData
    const deleteRule = async (ruleId: number | null, deleteAll = false) => {
        try {
            const updatedRules = deleteAll ? [] : rules.filter((rule) => rule.id !== ruleId);
            setRules(updatedRules);

            if (deleteAll) {
                const { error } = await fetchData('data-filtering/datasets/delete-rules', {
                    method: 'POST',
                    body: JSON.stringify({ workspace_id: currentWorkspace.id })
                });
                if (error) console.error('Error deleting all rules:', error);
            } else {
                const { error } = await fetchData('data-filtering/datasets/rules', {
                    method: 'POST',
                    body: JSON.stringify({
                        workspace_id: currentWorkspace.id,
                        rules: updatedRules
                    })
                });
                if (error) console.error('Error updating rules:', error);
            }
        } catch (err) {
            console.error(err);
        }
    };

    // Reorder rules using fetchData
    const reorderRules = async (updatedRules: Rule[]) => {
        try {
            setRules(updatedRules);
            const { error } = await fetchData('data-filtering/datasets/rules', {
                method: 'POST',
                body: JSON.stringify({
                    workspace_id: currentWorkspace.id,
                    rules: updatedRules
                })
            });
            if (error) {
                console.error('Error reordering rules:', error);
            }
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchRules();
        fetchProcessedData();

        return () => {
            if (!hasSavedRef.current) {
                saveWorkspaceData();
                hasSavedRef.current = true;
            }
        };
    }, []);

    const handleOpenModal = () => setModalOpen(true);
    const handleCloseModal = () => setModalOpen(false);

    return (
        <div className="flex min-h-page bg-gray-100">
            {/* Left Panel */}
            <div className="flex flex-col w-1/2 min-h-page">
                <div className="bg-white shadow-sm p-4">
                    <h2 className="text-lg font-bold mb-2">Rules List</h2>
                    <p className="text-sm text-gray-600 mb-2">Tokenizer: {tokenizer}</p>

                    {/* Method Dropdown */}
                    <select
                        value={method}
                        onChange={(e) => setMethod(e.target.value)}
                        className="w-full border rounded px-3 py-2 text-sm mb-4">
                        <option value="Lemmatizer: spacy en_core_web_sm">
                            Lemmatizer: spacy en_core_web_sm
                        </option>
                        <option value="Other Method">Other Method</option>
                    </select>

                    <div className="flex items-center gap-4">
                        <button
                            className="bg-blue-500 text-white px-4 py-2 text-sm rounded hover:bg-blue-600"
                            onClick={applyRules}
                            disabled={processing}>
                            {processing ? 'Processing...' : 'Apply Rules'}
                        </button>
                        <button
                            onClick={handleOpenModal}
                            className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded text-sm">
                            Create Rule
                        </button>
                        <button
                            onClick={() => deleteRule(null, true)}
                            className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded text-sm">
                            Delete All Rules
                        </button>
                    </div>
                </div>

                <div className="flex-grow bg-white px-4 shadow-sm rounded overflow-y-auto">
                    <RulesTable
                        rules={rules}
                        deleteRule={deleteRule}
                        reorderRules={reorderRules}
                        addRule={addRule}
                    />
                </div>
                <div className="bg-white p-4 shadow-sm">
                    <h3 className="text-lg font-bold mb-2">Dataset Statistics</h3>
                    <p className="text-sm">
                        <strong>Total Documents:</strong> {stats.totalDocs}
                    </p>
                    <p className="text-sm">
                        <strong>Total Tokens:</strong> {stats.totalTokens}
                    </p>
                    <p className="text-sm">
                        <strong>Unique Tokens:</strong> {stats.uniqueTokens}
                    </p>
                </div>
            </div>

            {/* Right Panel */}
            <div className="flex flex-col w-1/2 border-l-2">
                <div className="max-h-1/2 p-2 bg-white shadow-sm border-b-2">
                    <h3 className="text-md font-bold mb-1">Included Words</h3>
                    <WordPanel
                        title="Included Words"
                        words={includedWords}
                        onDropWord={(word) => console.log('Dropped word:', word)}
                    />
                </div>
                <div className="max-h-1/2 p-2 bg-white shadow-sm">
                    <h3 className="text-md font-bold mb-1">Removed Words</h3>
                    <WordPanel
                        title="Removed Words"
                        words={removedWords}
                        onDropWord={(word) => console.log('Dropped word:', word)}
                    />
                </div>
            </div>
            <CreateRuleModal isOpen={isModalOpen} onClose={handleCloseModal} onSave={addRule} />
        </div>
    );
};

export default HomePage;

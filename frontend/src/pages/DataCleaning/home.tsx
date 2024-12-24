import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import RulesTable from '../../components/DataCleaning/rules_table';
import WordPanel, { WordDetail } from '../../components/DataCleaning/word_panel';
import CreateRuleModal from '../../components/DataCleaning/rule_modal';
import { Rule } from '../../types/DataCleaning/shared';
import { useCollectionContext } from '../../context/collection_context';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import useServerUtils from '../../hooks/Shared/get_server_url';

const tryRequest = async (promise: Promise<Response>) => {
    try {
        const response = await promise;

        if (!response.ok) {
            const errorDetails = await response.json();
            throw new Error(errorDetails?.message || 'Request failed');
        }

        const data = await response.json();
        return { data }; // Mimic axios' response structure
    } catch (error) {
        console.error('Request failed', error);
        throw error;
    }
};

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

    const { datasetId } = useCollectionContext();
    const { getServerUrl } = useServerUtils();

    const { saveWorkspaceData } = useWorkspaceUtils();
    const hasSavedRef = useRef(false);

    const fetchRules = async () => {
        try {
            const response = await tryRequest(
                fetch(getServerUrl(`data-filtering/datasets/rules`), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ dataset_id: datasetId })
                })
            );
            setRules(response.data);
        } catch {
            // Errors are handled by tryRequest
        }
    };

    const fetchProcessedData = async () => {
        try {
            const [postsResponse, commentsResponse, includedWordsResponse, removedWordsResponse] =
                await Promise.all([
                    tryRequest(
                        fetch(getServerUrl(`data-filtering/datasets/processed-posts`), {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ dataset_id: datasetId })
                        })
                    ),
                    tryRequest(
                        fetch(getServerUrl(`data-filtering/datasets/processed-comments`), {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ dataset_id: datasetId })
                        })
                    ),
                    tryRequest(
                        fetch(getServerUrl(`data-filtering/datasets/included-words`), {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ dataset_id: datasetId })
                        })
                    ),
                    tryRequest(
                        fetch(getServerUrl(`data-filtering/datasets/removed-words`), {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ dataset_id: datasetId })
                        })
                    )
                ]);

            setProcessedPosts(postsResponse.data.posts);
            setProcessedComments(commentsResponse.data.comments);

            setStats({
                totalDocs: postsResponse.data.posts.length + commentsResponse.data.comments.length,
                totalTokens:
                    includedWordsResponse.data.words.reduce(
                        (acc: number, iWord: any) => acc + iWord.count,
                        0
                    ) +
                    removedWordsResponse.data.words.reduce(
                        (acc: number, rWord: any) => acc + rWord.count,
                        0
                    ),
                uniqueTokens:
                    includedWordsResponse.data.words.length + removedWordsResponse.data.words.length
            });

            setIncludedWords(includedWordsResponse.data.words);
            setRemovedWords(removedWordsResponse.data.words);
        } catch {
            // Errors are handled by tryRequest
        }
    };

    const applyRules = async () => {
        setProcessing(true);
        try {
            await tryRequest(
                fetch(getServerUrl(`data-filtering/datasets/apply-rules`), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        dataset_id: datasetId,
                        rules
                    })
                })
            );
            await fetchProcessedData();
        } catch {
            // Errors are handled by tryRequest
        }
        setProcessing(false);
    };

    const addRule = async (newRule: Rule) => {
        try {
            const updatedRules = [...rules, { ...newRule, id: rules.length + 1 }];
            setRules(updatedRules);

            await tryRequest(
                fetch(getServerUrl(`data-filtering/datasets/rules`), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        dataset_id: datasetId,
                        rules: updatedRules
                    })
                })
            );
        } catch {
            // Errors are handled by tryRequest
        }
    };

    const deleteRule = async (ruleId: number | null, deleteAll = false) => {
        try {
            const updatedRules = deleteAll ? [] : rules.filter((rule) => rule.id !== ruleId);
            setRules(updatedRules);

            if (deleteAll) {
                await tryRequest(
                    fetch(getServerUrl(`data-filtering/datasets/delete-rules`), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ dataset_id: datasetId })
                    })
                );
            } else {
                await tryRequest(
                    fetch(getServerUrl(`data-filtering/datasets/rules`), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            dataset_id: datasetId,
                            rules: updatedRules
                        })
                    })
                );
            }
        } catch {
            // Errors are handled by tryRequest
        }
    };

    const reorderRules = async (updatedRules: Rule[]) => {
        try {
            setRules(updatedRules);

            await tryRequest(
                fetch(getServerUrl(`data-filtering/datasets/rules`), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        dataset_id: datasetId,
                        rules: updatedRules
                    })
                })
            );
        } catch {
            // Errors are handled by tryRequest
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
        <div className="flex min-h-panel gap-x-1 bg-gray-100">
            {/* Left Panel */}
            <div className="flex flex-col w-1/2 h-full">
                <div className="bg-white p-4 shadow-sm">
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

                <div className="flex-grow bg-white shadow-sm p-4 rounded overflow-y-auto">
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
            <div className="flex flex-col w-1/2 h-full">
                <div className="flex-1 p-2 bg-white shadow-sm mb-2">
                    <h3 className="text-md font-bold mb-1">Included Words</h3>
                    <WordPanel
                        title="Included Words"
                        words={includedWords}
                        onDropWord={(word) => console.log('Dropped word:', word)}
                    />
                </div>
                <div className="flex-1 p-2 bg-white shadow-sm">
                    <h3 className="text-md font-bold mb-1">Removed Words</h3>
                    <WordPanel
                        title="Removed Words"
                        words={removedWords}
                        onDropWord={(word) => console.log('Dropped word:', word)}
                    />
                    <CreateRuleModal
                        isOpen={isModalOpen}
                        onClose={handleCloseModal}
                        onSave={addRule}
                    />
                </div>
            </div>
        </div>
    );
};

export default HomePage;

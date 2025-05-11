import React, { useState, useEffect, useMemo, FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaPlus, FaTrash } from 'react-icons/fa';
import { ISettingsConfig, useSettings } from '../../../context/settings-context';
import { useApi } from '../../../hooks/Shared/use-api';
import { useWebSocket } from '../../../context/websocket-context';
import { REMOTE_SERVER_ROUTES } from '../../../constants/Shared';
import ModelSelect from '../components/model-select';
import AIParameters from '../components/parameters';
import SearchMetadata from '../components/search-metadata';
import DownloadedModels from '../components/downloaded-model';
import PullProgress from '../components/pull-progress';
import { CommonSettingTabProps } from '../../../types/Settings/props';
import { ModelObj, Metadata, ProviderSettings } from '../../../types/Settings/shared';

const { ipcRenderer } = window.require('electron');

const AISettings: FC<CommonSettingTabProps> = ({ setSaveCurrentSettings }) => {
    const { settings, updateSettings, markSectionDirty, setDisableBack } = useSettings();
    const { ai } = settings;
    const { fetchData } = useApi();
    const { registerCallback, unregisterCallback } = useWebSocket();

    const [localAi, setLocalAi] = useState(ai);

    const [downloadedModels, setDownloadedModels] = useState<any[]>([]);
    const [downloadedModelsLoading, setDownloadedModelsLoading] = useState(false);
    const [ollamaInput, setOllamaInput] = useState('');
    const [metadata, setMetadata] = useState<Metadata | null>(null);
    const [metadataError, setMetadataError] = useState('');
    const [searchLoading, setSearchLoading] = useState(false);
    const [pullLoading, setPullLoading] = useState(false);
    const [pullProgress, setPullProgress] = useState(0);
    const [pullStatus, setPullStatus] = useState('');
    const [pullingModelName, setPullingModelName] = useState('');
    const [localEmbedding, setLocalEmbedding] = useState('');
    const [embeddingError, setEmbeddingError] = useState<string | null>(null);
    const [isCheckingEmbedding, setIsCheckingEmbedding] = useState(false);
    const [newModelInput, setNewModelInput] = useState('');
    const [modelError, setModelError] = useState<string | null>(null);
    const [isCheckingModel, setIsCheckingModel] = useState(false);

    useEffect(() => {
        setLocalAi(ai);
    }, [ai]);

    useEffect(() => {
        setSaveCurrentSettings(() => () => updateSettings('ai', localAi));
    }, [localAi, updateSettings, setSaveCurrentSettings]);

    const [selectedProvider, setSelectedProvider] = useState<string>(
        localAi.model.split('-', 1)[0]
    );

    useEffect(() => {
        const providerSettings = localAi.providers[selectedProvider];
        setLocalEmbedding(providerSettings?.textEmbedding || '');
        setEmbeddingError(null);
        setNewModelInput('');
        setModelError(null);
    }, [selectedProvider, localAi.providers]);

    useEffect(() => {
        const fetchDownloadedModels = async () => {
            setDownloadedModelsLoading(true);
            try {
                const { data, error } = await fetchData(REMOTE_SERVER_ROUTES.OLLAMA_LIST);
                if (error) console.error('Error fetching downloaded models:', error);
                else setDownloadedModels(data.models || []);
            } catch (err) {
                console.error(err);
            }
            setDownloadedModelsLoading(false);
        };
        fetchDownloadedModels();
    }, [fetchData]);

    // WebSocket for Ollama pull progress
    useEffect(() => {
        const handleWsMessage = (msg: string) => {
            try {
                const data = JSON.parse(msg);
                if (data.total && data.completed !== undefined) {
                    const progress = (data.completed / data.total) * 100;
                    setPullProgress(progress);
                    setPullStatus(
                        pullingModelName ? `Pulling ${pullingModelName}` : data.status || ''
                    );
                }
            } catch (e) {
                console.error('Error parsing websocket message', e);
            }
        };
        registerCallback('pull-ollama-model', handleWsMessage);
        return () => unregisterCallback('pull-ollama-model');
    }, [pullingModelName, registerCallback, unregisterCallback]);

    const combinedModels = useMemo(() => {
        const models: string[] = [];
        for (const provider in localAi.providers) {
            const providerModels = localAi.providers[provider].modelList.map(
                (model) => `${provider}-${model}`
            );
            models.push(...providerModels);
        }
        return Array.from(new Set(models));
    }, [localAi.providers]);

    const handleModelChange = (e: any) => {
        setLocalAi((prev) => ({ ...prev, model: e.target.value }));
        markSectionDirty('ai', true);
    };

    const handleTemperatureChange = (newTemperature: number) => {
        setLocalAi((prev) => ({ ...prev, temperature: newTemperature }));
        markSectionDirty('ai', true);
    };

    const handleCutoffChange = (newCutoff: number) => {
        setLocalAi((prev) => ({ ...prev, cutoff: newCutoff }));
        markSectionDirty('ai', true);
    };

    const handleRandomSeedChange = (newSeed: number) => {
        setLocalAi((prev) => ({ ...prev, randomSeed: newSeed }));
        markSectionDirty('ai', true);
    };

    const handleProviderChange = (e: any) => {
        setSelectedProvider(e.target.value);
    };

    const handleSearchMetadata = async () => {
        setSearchLoading(true);
        setMetadataError('');
        setMetadata(null);
        try {
            const { data, error } = await fetchData(
                `${REMOTE_SERVER_ROUTES.OLLAMA_MODEL_METADATA}/${encodeURIComponent(ollamaInput)}`
            );
            if (error) setMetadataError(error.message.error_message || 'Unknown error');
            else setMetadata(data);
        } catch (error: any) {
            setMetadataError(error?.message || 'Unknown error');
        }
        setSearchLoading(false);
    };

    const handleClearSearch = () => {
        setOllamaInput('');
        setMetadata(null);
        setMetadataError('');
    };

    const handleApiKeyChange = (e: any) => {
        if (selectedProvider === 'google' || selectedProvider === 'openai') {
            setLocalAi((prev) => ({
                ...prev,
                providers: {
                    ...prev.providers,
                    [selectedProvider]: {
                        ...prev.providers[selectedProvider],
                        apiKey: e.target.value
                    }
                }
            }));
            markSectionDirty('ai', true);
        }
    };

    const handleCredentialsPathChange = (e: any) => {
        if (selectedProvider === 'vertexai') {
            setLocalAi((prev) => ({
                ...prev,
                providers: {
                    ...prev.providers,
                    [selectedProvider]: {
                        ...prev.providers[selectedProvider],
                        credentialsPath: e.target.value
                    }
                }
            }));
            markSectionDirty('ai', true);
        }
    };

    const handleUpdateTextEmbedding = async () => {
        setIsCheckingEmbedding(true);
        setEmbeddingError(null);
        try {
            let endpoint = REMOTE_SERVER_ROUTES.CHECK_EMBEDDING;

            if (endpoint) {
                const { data, error } = await fetchData(endpoint, {
                    method: 'POST',
                    body: JSON.stringify({
                        name: localEmbedding,
                        provider: selectedProvider
                    })
                });
                if (error) {
                    setEmbeddingError('Invalid text embedding - ' + error.message.error_message);
                } else {
                    setLocalAi((prev) => ({
                        ...prev,
                        providers: {
                            ...prev.providers,
                            [selectedProvider]: {
                                ...prev.providers[selectedProvider],
                                textEmbedding: localEmbedding
                            }
                        }
                    }));
                    markSectionDirty('ai', true);
                }
            } else {
                setLocalAi((prev) => ({
                    ...prev,
                    providers: {
                        ...prev.providers,
                        [selectedProvider]: {
                            ...prev.providers[selectedProvider],
                            textEmbedding: localEmbedding
                        }
                    }
                }));
                markSectionDirty('ai', true);
            }
        } catch (err) {
            setEmbeddingError('Error checking text embedding');
        } finally {
            setIsCheckingEmbedding(false);
        }
    };

    const handleAddModelWithValidation = async () => {
        setModelError(null);
        const newModel = newModelInput.trim();
        const providerSettings = localAi.providers[selectedProvider];
        if (!newModel || providerSettings.modelList.includes(newModel)) return;

        setIsCheckingModel(true);
        try {
            let endpoint = REMOTE_SERVER_ROUTES.CHECK_MODEL;

            if (endpoint) {
                const { data, error } = await fetchData(endpoint, {
                    method: 'POST',
                    body: JSON.stringify({
                        name: newModel,
                        provider: selectedProvider
                    })
                });
                if (!error) {
                    const newModelList = [...providerSettings.modelList, newModel];
                    setLocalAi((prev) => ({
                        ...prev,
                        providers: {
                            ...prev.providers,
                            [selectedProvider]: {
                                ...prev.providers[selectedProvider],
                                modelList: newModelList
                            }
                        }
                    }));
                    markSectionDirty('ai', true);
                    setNewModelInput('');
                } else {
                    setModelError('Invalid model - ' + error.message.error_message);
                }
            } else {
                const newModelList = [...providerSettings.modelList, newModel];
                setLocalAi((prev) => ({
                    ...prev,
                    providers: {
                        ...prev.providers,
                        [selectedProvider]: {
                            ...prev.providers[selectedProvider],
                            modelList: newModelList
                        }
                    }
                }));
                markSectionDirty('ai', true);
                setNewModelInput('');
            }
        } catch (err) {
            setModelError('Error checking model');
        } finally {
            setIsCheckingModel(false);
        }
    };

    const handleRemoveModel = (modelToRemove: string) => {
        const providerSettings = localAi.providers[selectedProvider];
        const newModelList = providerSettings.modelList.filter((m) => m !== modelToRemove);
        setLocalAi((prev) => ({
            ...prev,
            providers: {
                ...prev.providers,
                [selectedProvider]: {
                    ...prev.providers[selectedProvider],
                    modelList: newModelList
                }
            }
        }));
        markSectionDirty('ai', true);
    };

    const handlePullModel = async (tag: string) => {
        setDisableBack(true);
        setPullLoading(true);
        setPullProgress(0);
        setPullStatus('');
        const fullModelName = `${metadata!.main_model.name}:${tag}`;
        setPullingModelName(fullModelName);
        try {
            const { data, error } = await fetchData(REMOTE_SERVER_ROUTES.OLLAMA_PULL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: fullModelName })
            });
            if (error) throw new Error(error.message.error_message || 'Unknown error');
            setDownloadedModels((prev) => [...prev, { name: fullModelName }]);
            const newModelList = [...(localAi.providers.ollama?.modelList || []), fullModelName];
            setLocalAi((prev) => ({
                ...prev,
                providers: {
                    ...prev.providers,
                    ollama: {
                        ...prev.providers.ollama,
                        modelList: newModelList
                    }
                }
            }));
            markSectionDirty('ai', true);
        } catch (error) {
            console.error('Error pulling model:', error);
        }
        setPullLoading(false);
        setPullingModelName('');
        setDisableBack(false);
    };

    const handleSelectCredentialsFolder = async () => {
        const filePath = await ipcRenderer.invoke('select-file', ['json']);
        if (filePath) {
            setLocalAi((prev) => ({
                ...prev,
                providers: {
                    ...prev.providers,
                    vertexai: {
                        ...prev.providers.vertexai,
                        credentialsPath: filePath
                    }
                }
            }));
            markSectionDirty('ai', true);
        }
    };

    const handleDeleteDownloadedModel = async (modelObj: ModelObj) => {
        try {
            const { error } = await fetchData(REMOTE_SERVER_ROUTES.OLLAMA_DELETE, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: modelObj.name })
            });
            if (error) console.error('Error deleting model:', error);
            else {
                setDownloadedModels((prev) => prev.filter((m) => m.name !== modelObj.name));
                const newModelList =
                    localAi.providers.ollama?.modelList.filter((m) => m !== modelObj.name) || [];
                setLocalAi((prev) => ({
                    ...prev,
                    providers: {
                        ...prev.providers,
                        ollama: {
                            ...prev.providers.ollama,
                            modelList: newModelList
                        }
                    }
                }));
                markSectionDirty('ai', true);
            }
        } catch (e) {
            console.error('Error deleting model:', e);
        }
    };

    const renderProviderSettings = () => {
        const providerSettings = localAi.providers[selectedProvider];
        if (!providerSettings) return <p>Provider not found</p>;

        if (selectedProvider === 'google' || selectedProvider === 'openai') {
            if ('apiKey' in providerSettings) {
                return (
                    <div>
                        <div>
                            <label className="block font-medium">API Key</label>
                            <input
                                type="text"
                                value={providerSettings.apiKey}
                                onChange={handleApiKeyChange}
                                className="w-full p-2 border border-gray-300 rounded mt-1"
                            />
                        </div>
                        <div className="mt-4">
                            <label className="block font-medium">Text Embedding</label>
                            <div className="flex items-center">
                                <input
                                    type="text"
                                    value={localEmbedding}
                                    onChange={(e) => {
                                        setLocalEmbedding(e.target.value);
                                        setEmbeddingError(null);
                                    }}
                                    className="mt-1 border rounded p-2 w-fit min-w-64"
                                />
                                <button
                                    onClick={handleUpdateTextEmbedding}
                                    disabled={isCheckingEmbedding}
                                    className={`ml-2 p-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors ${
                                        isCheckingEmbedding ? 'opacity-50 cursor-not-allowed' : ''
                                    }`}>
                                    {isCheckingEmbedding ? 'Checking...' : 'Check embedding'}
                                </button>
                            </div>
                            {embeddingError && (
                                <p className="text-red-500 mt-1">{embeddingError}</p>
                            )}
                        </div>
                        <div className="mt-4">
                            <h3 className="font-medium">Model List</h3>
                            <ul className="space-y-2 mt-2">
                                <AnimatePresence>
                                    {providerSettings.modelList.map((model) => (
                                        <motion.li
                                            key={model}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 20 }}
                                            className="flex justify-between items-center p-2 rounded shadow">
                                            <span>{model}</span>
                                            <button
                                                onClick={() => handleRemoveModel(model)}
                                                className="ml-2 text-red-500 hover:text-red-700 transition-colors">
                                                <FaTrash />
                                            </button>
                                        </motion.li>
                                    ))}
                                </AnimatePresence>
                            </ul>
                            <div className="mt-4 flex items-center">
                                <input
                                    type="text"
                                    placeholder="Add new model"
                                    value={newModelInput}
                                    onChange={(e) => setNewModelInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleAddModelWithValidation();
                                    }}
                                    className="border rounded p-2 w-full"
                                />
                                <button
                                    onClick={handleAddModelWithValidation}
                                    disabled={isCheckingModel}
                                    className={`ml-2 p-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors ${
                                        isCheckingModel ? 'opacity-50 cursor-not-allowed' : ''
                                    }`}>
                                    {isCheckingModel ? (
                                        <span className="flex items-center">
                                            <span className="animate-spin mr-1">⏳</span>{' '}
                                            Checking...
                                        </span>
                                    ) : (
                                        <FaPlus />
                                    )}
                                </button>
                            </div>
                            {modelError && <p className="text-red-500 mt-1">{modelError}</p>}
                        </div>
                    </div>
                );
            }
            return <p>Invalid provider settings for {selectedProvider}</p>;
        }

        if (selectedProvider === 'vertexai') {
            if ('credentialsPath' in providerSettings) {
                return (
                    <div>
                        <div className="mb-4">
                            <label className="block mb-2 font-medium">Credentials Path</label>
                            <div className="flex">
                                <input
                                    type="text"
                                    value={providerSettings.credentialsPath}
                                    onChange={handleCredentialsPathChange}
                                    className="flex-grow p-2 border border-gray-300 rounded-l"
                                    placeholder="Enter or select credentials folder"
                                />
                                <button
                                    onClick={handleSelectCredentialsFolder}
                                    className="p-2 bg-blue-500 text-white rounded-r">
                                    Select Folder
                                </button>
                            </div>
                        </div>
                        <div className="mt-4">
                            <label className="block font-medium">Text Embedding</label>
                            <div className="flex items-center">
                                <input
                                    type="text"
                                    value={localEmbedding}
                                    onChange={(e) => {
                                        setLocalEmbedding(e.target.value);
                                        setEmbeddingError(null);
                                    }}
                                    className="mt-1 border rounded p-2 w-fit min-w-64"
                                />
                                <button
                                    onClick={handleUpdateTextEmbedding}
                                    disabled={isCheckingEmbedding}
                                    className={`ml-2 p-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors ${
                                        isCheckingEmbedding ? 'opacity-50 cursor-not-allowed' : ''
                                    }`}>
                                    {isCheckingEmbedding ? 'Checking...' : 'Check and Update'}
                                </button>
                            </div>
                            {embeddingError && (
                                <p className="text-red-500 mt-1">{embeddingError}</p>
                            )}
                        </div>
                        <div className="mt-4">
                            <h3 className="font-medium">Model List</h3>
                            <ul className="space-y-2 mt-2">
                                <AnimatePresence>
                                    {providerSettings.modelList.map((model) => (
                                        <motion.li
                                            key={model}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 20 }}
                                            className="flex justify-between items-center p-2 rounded shadow">
                                            <span>{model}</span>
                                            <button
                                                onClick={() => handleRemoveModel(model)}
                                                className="ml-2 text-red-500 hover:text-red-700 transition-colors">
                                                <FaTrash />
                                            </button>
                                        </motion.li>
                                    ))}
                                </AnimatePresence>
                            </ul>
                            <div className="mt-4 flex items-center">
                                <input
                                    type="text"
                                    placeholder="Add new model"
                                    value={newModelInput}
                                    onChange={(e) => setNewModelInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleAddModelWithValidation();
                                    }}
                                    className="border rounded p-2 w-full"
                                />
                                <button
                                    onClick={handleAddModelWithValidation}
                                    disabled={isCheckingModel}
                                    className={`ml-2 p-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors ${
                                        isCheckingModel ? 'opacity-50 cursor-not-allowed' : ''
                                    }`}>
                                    {isCheckingModel ? (
                                        <span className="flex items-center">
                                            <span className="animate-spin mr-1">⏳</span>{' '}
                                            Checking...
                                        </span>
                                    ) : (
                                        <FaPlus />
                                    )}
                                </button>
                            </div>
                            {modelError && <p className="text-red-500 mt-1">{modelError}</p>}
                        </div>
                    </div>
                );
            }
            return <p>Invalid provider settings for {selectedProvider}</p>;
        }

        if (selectedProvider === 'ollama') {
            return (
                <div>
                    <DownloadedModels
                        downloadedModels={downloadedModels}
                        downloadedModelsLoading={downloadedModelsLoading}
                        handleDeleteDownloadedModel={handleDeleteDownloadedModel}
                    />
                    <SearchMetadata
                        ollamaInput={ollamaInput}
                        setOllamaInput={setOllamaInput}
                        handleSearchMetadata={handleSearchMetadata}
                        handleClearSearch={handleClearSearch}
                        searchLoading={searchLoading}
                        metadata={metadata}
                        metadataError={metadataError}
                        pullLoading={pullLoading}
                        handlePullModel={handlePullModel}
                        pullingModelName={pullingModelName}
                        downloadedModels={downloadedModels}
                    />
                    <PullProgress
                        pullLoading={pullLoading}
                        pullProgress={pullProgress}
                        pullStatus={pullStatus}
                    />
                </div>
            );
        }

        return <p>Unknown provider</p>;
    };

    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">AI Settings</h2>
            <ModelSelect
                combinedModels={combinedModels}
                selectedModel={localAi.model}
                onModelChange={handleModelChange}
            />
            <AIParameters
                temperature={localAi.temperature}
                randomSeed={localAi.randomSeed}
                cutoff={localAi.cutoff}
                onTemperatureChange={handleTemperatureChange}
                onRandomSeedChange={handleRandomSeedChange}
                onCutoffChange={handleCutoffChange}
            />
            <div className="my-4">
                <label className="block font-medium">Select Provider</label>
                <select
                    value={selectedProvider}
                    onChange={handleProviderChange}
                    className="w-full p-2 border border-gray-300 rounded mt-1">
                    {Object.entries(localAi.providers).map(([k, v]) => (
                        <option key={k} value={k}>
                            {v.name}
                        </option>
                    ))}
                </select>
            </div>
            {renderProviderSettings()}
        </div>
    );
};

export default AISettings;

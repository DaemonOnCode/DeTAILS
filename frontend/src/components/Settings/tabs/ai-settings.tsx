import React, { useState, useEffect } from 'react';
import { useSettings } from '../../../context/settings-context';
import { MODEL_LIST, REMOTE_SERVER_ROUTES } from '../../../constants/Shared';
import { useApi } from '../../../hooks/Shared/use-api';
import { useWebSocket } from '../../../context/websocket-context';
import CredentialsInput from '../components/credentials-input';
import DownloadedModels from '../components/downloaded-model';
import ModelSelect from '../components/model-select';
import PullProgress from '../components/pull-progress';
import SearchMetadata from '../components/search-metadata';
import AIParameters from '../components/parameters';

const AISettings: React.FC = () => {
    const { settings, updateSettings, setDisableBack } = useSettings();
    const { ai } = settings;
    const { fetchData } = useApi();
    const { registerCallback, unregisterCallback } = useWebSocket();

    const [googleCredentialsPath, setGoogleCredentialsPath] = useState<string>(
        ai?.googleCredentialsPath || ''
    );
    const [ollamaInput, setOllamaInput] = useState<string>('');
    // downloadedModels is an array of objects.
    const [downloadedModels, setDownloadedModels] = useState<any[]>([]);
    const [downloadedModelsLoading, setDownloadedModelsLoading] = useState<boolean>(false);
    const [metadata, setMetadata] = useState<any>(null);
    const [metadataError, setMetadataError] = useState<string>('');
    const [searchLoading, setSearchLoading] = useState<boolean>(false);
    const [pullLoading, setPullLoading] = useState<boolean>(false);
    const [selectedModel, setSelectedModel] = useState<string>(
        ai?.model || MODEL_LIST.GEMINI_FLASH_THINKING
    );

    // State for pull progress and model being pulled.
    const [pullProgress, setPullProgress] = useState<number>(0);
    const [pullStatus, setPullStatus] = useState<string>('');
    const [pullingModelName, setPullingModelName] = useState<string>('');

    // Update local state if settings change.
    useEffect(() => {
        setGoogleCredentialsPath(ai?.googleCredentialsPath || '');
        setSelectedModel(ai?.model || MODEL_LIST.GEMINI_FLASH_THINKING);
    }, [ai]);

    useEffect(() => {
        console.log('Selected model:', selectedModel);
    }, [selectedModel]);

    // Subscribe to websocket messages for pull progress.
    useEffect(() => {
        const handleWsMessage = (msg: string) => {
            try {
                const data = JSON.parse(msg);
                if (data.total && data.completed !== undefined) {
                    const progress = (data.completed / data.total) * 100;
                    setPullProgress(progress);
                    if (pullingModelName) {
                        setPullStatus(`Pulling ${pullingModelName}`);
                    } else {
                        setPullStatus(data.status || '');
                    }
                }
            } catch (e) {
                console.error('Error parsing websocket message', e);
            }
        };
        registerCallback('pull-ollama-model', handleWsMessage);
        return () => {
            unregisterCallback('pull-ollama-model');
        };
    }, [pullingModelName, registerCallback, unregisterCallback]);

    useEffect(() => {
        const fetchDownloadedModels = async () => {
            setDownloadedModelsLoading(true);
            try {
                const { data, error } = await fetchData(REMOTE_SERVER_ROUTES.OLLAMA_LIST);
                if (error) {
                    console.error('Error fetching downloaded models:', error);
                } else {
                    setDownloadedModels(data.models);
                }
            } catch (err) {
                console.error(err);
            }
            setDownloadedModelsLoading(false);
        };
        fetchDownloadedModels();
    }, [fetchData]);

    const handleModelChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        await updateSettings('ai', { googleCredentialsPath, model: e.target.value });
        setSelectedModel(e.target.value);
    };

    const handleUpdateAISettings = async () => {
        await updateSettings('ai', { googleCredentialsPath, model: selectedModel });
    };

    // Search for metadata from the Ollama API.
    const handleSearchMetadata = async () => {
        setSearchLoading(true);
        setMetadataError('');
        setMetadata(null);
        try {
            const { data, error } = await fetchData(
                `${REMOTE_SERVER_ROUTES.OLLAMA_MODEL_METADATA}/${encodeURIComponent(ollamaInput)}`
            );
            if (error) {
                console.log('Error fetching metadata:', error);
                setMetadataError(error.message.error_message || 'Unknown error');
            } else {
                setMetadata(data);
            }
        } catch (error: any) {
            console.error('Error fetching metadata:', error);
            setMetadataError(error.message || 'Unknown error');
        }
        setSearchLoading(false);
    };

    const handleClearSearch = () => {
        setOllamaInput('');
        setMetadata(null);
        setMetadataError('');
    };

    const handlePullModel = async (tag: string) => {
        setDisableBack(true);
        setPullLoading(true);
        setPullProgress(0);
        setPullStatus('');
        const fullModelName = `${metadata.main_model.name}:${tag}`;
        setPullingModelName(fullModelName); // Use full model name with tag
        try {
            const { data, error } = await fetchData(REMOTE_SERVER_ROUTES.OLLAMA_PULL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: fullModelName })
            });
            if (error) throw new Error(error.message.error_message || 'Unknown error');
            console.log('Pulled model data:', data);
            setSelectedModel(fullModelName);
            setDownloadedModels((prev) => [...prev, { name: fullModelName }]);
        } catch (error) {
            console.error('Error pulling model:', error);
        }
        setPullLoading(false);
        setPullingModelName('');
        setDisableBack(false);
    };

    // Delete a downloaded model.
    const handleDeleteDownloadedModel = async (modelObj: any) => {
        try {
            const { data, error } = await fetchData(REMOTE_SERVER_ROUTES.OLLAMA_DELETE, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: modelObj.name })
            });
            if (error) {
                console.error('Error deleting model:', error);
            } else {
                setDownloadedModels((prev) => prev.filter((m) => m.name !== modelObj.name));
            }
        } catch (e) {
            console.error('Error deleting model:', e);
        }
    };

    // Combine built-in models and downloaded models for the select dropdown.
    const combinedModels = Array.from(
        new Set([
            ...Object.values(ai.modelList),
            ...downloadedModels.map((modelObj) => `ollama-${modelObj.name}`)
        ])
    );

    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">AI Settings</h2>
            <ModelSelect
                combinedModels={combinedModels}
                selectedModel={selectedModel}
                onModelChange={handleModelChange}
            />
            <DownloadedModels
                downloadedModels={downloadedModels}
                downloadedModelsLoading={downloadedModelsLoading}
                handleDeleteDownloadedModel={handleDeleteDownloadedModel}
            />
            <AIParameters />
            <CredentialsInput
                googleCredentialsPath={googleCredentialsPath}
                handleCredentialsPathChange={(e) => setGoogleCredentialsPath(e.target.value)}
                handleUpdateAISettings={handleUpdateAISettings}
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
};

export default AISettings;

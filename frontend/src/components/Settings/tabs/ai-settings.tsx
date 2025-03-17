import React, { useState, useEffect, useCallback, FC } from 'react';
import { useSettings } from '../../../context/settings-context';
import { useApi } from '../../../hooks/Shared/use-api';
import { useWebSocket } from '../../../context/websocket-context';
import { MODEL_LIST, REMOTE_SERVER_ROUTES } from '../../../constants/Shared';
import CredentialsInput from '../components/credentials-input';
import DownloadedModels from '../components/downloaded-model';
import ModelSelect from '../components/model-select';
import AIParameters from '../components/parameters';
import SearchMetadata from '../components/search-metadata';
import PullProgress from '../components/pull-progress';
import { CommonSettingTabProps } from '../../../types/Settings/props';
import { ModelObj, Metadata } from '../../../types/Settings/shared';

const AISettings: FC<CommonSettingTabProps> = ({ setSaveCurrentSettings }) => {
    const { settings, updateSettings, markSectionDirty, setDisableBack } = useSettings();
    const { ai } = settings;
    const { fetchData } = useApi();
    const { registerCallback, unregisterCallback } = useWebSocket();

    const [localAi, setLocalAi] = useState({
        model: ai?.model || MODEL_LIST.GEMINI_FLASH_THINKING,
        googleCredentialsPath: ai?.googleCredentialsPath || '',
        temperature: ai?.temperature ?? 0.0,
        randomSeed: ai?.randomSeed ?? 0,
        modelList: ai?.modelList ?? [],
        textEmbedding: ai?.textEmbedding ?? ''
    });

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

    useEffect(() => {
        setLocalAi({
            model: ai?.model || MODEL_LIST.GEMINI_FLASH_THINKING,
            googleCredentialsPath: ai?.googleCredentialsPath || '',
            temperature: ai?.temperature ?? 0.0,
            randomSeed: ai?.randomSeed ?? 0,
            modelList: ai?.modelList ?? [],
            textEmbedding: ai?.textEmbedding ?? ''
        });
    }, [ai]);

    useEffect(() => {
        setSaveCurrentSettings(() => () => updateSettings('ai', localAi));
    }, [localAi, updateSettings, setSaveCurrentSettings]);

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

    const handleModelChange = (e: any) => {
        setLocalAi((prev) => ({ ...prev, model: e.target.value }));
        markSectionDirty('ai', true);
    };

    const handleCredentialsPathChange = (e: any) => {
        setLocalAi((prev) => ({ ...prev, googleCredentialsPath: e.target.value }));
        markSectionDirty('ai', true);
    };

    const handleTemperatureChange = (newTemperature: number) => {
        setLocalAi((prev) => ({ ...prev, temperature: newTemperature }));
        markSectionDirty('ai', true);
    };

    const handleRandomSeedChange = (newSeed: number) => {
        setLocalAi((prev) => ({ ...prev, randomSeed: newSeed }));
        markSectionDirty('ai', true);
    };

    const handleTextEmbeddingChange = (newEmbedding: string) => {
        setLocalAi((prev) => ({ ...prev, textEmbedding: newEmbedding }));
        markSectionDirty('ai', true);
    };

    const handleModelListChange = (newModelList: string[]) => {
        setLocalAi((prev) => ({ ...prev, modelList: newModelList }));
        markSectionDirty('ai', true);
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
            setMetadataError(error ?? 'Unknown error');
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
        const fullModelName = `${metadata!.main_model.name}:${tag}`;
        setPullingModelName(fullModelName);
        try {
            const { data, error } = await fetchData(REMOTE_SERVER_ROUTES.OLLAMA_PULL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: fullModelName })
            });
            if (error) throw new Error(error.message.error_message || 'Unknown error');
            setLocalAi((prev) => ({ ...prev, model: fullModelName }));
            setDownloadedModels((prev) => [...prev, { name: fullModelName }]);
            markSectionDirty('ai', true);
        } catch (error) {
            console.error('Error pulling model:', error);
        }
        setPullLoading(false);
        setPullingModelName('');
        setDisableBack(false);
    };

    const handleDeleteDownloadedModel = async (modelObj: ModelObj) => {
        try {
            const { error } = await fetchData(REMOTE_SERVER_ROUTES.OLLAMA_DELETE, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: modelObj.name })
            });
            if (error) console.error('Error deleting model:', error);
            else setDownloadedModels((prev) => prev.filter((m) => m.name !== modelObj.name));
        } catch (e) {
            console.error('Error deleting model:', e);
        }
    };

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
                selectedModel={localAi.model}
                onModelChange={handleModelChange}
            />
            <AIParameters
                temperature={localAi.temperature}
                randomSeed={localAi.randomSeed}
                modelList={localAi.modelList}
                textEmbedding={localAi.textEmbedding}
                onTemperatureChange={handleTemperatureChange}
                onRandomSeedChange={handleRandomSeedChange}
                onTextEmbeddingChange={handleTextEmbeddingChange}
                onModelListChange={handleModelListChange}
            />
            <CredentialsInput
                googleCredentialsPath={localAi.googleCredentialsPath}
                onCredentialsPathChange={handleCredentialsPathChange}
            />
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
};

export default AISettings;

import { ChangeEvent } from 'react';
import { Metadata, ModelObj } from './shared';

export interface CommonSettingTabProps {
    setSaveCurrentSettings: (e: () => () => void) => void;
}

export interface CredentialsInputProps {
    googleCredentialsPath: string;
    onCredentialsPathChange: (e: ChangeEvent<HTMLInputElement>) => void;
}

export interface DownloadedModelsProps {
    downloadedModels: ModelObj[];
    downloadedModelsLoading: boolean;
    handleDeleteDownloadedModel: (modelObj: ModelObj) => void;
}

export interface ModelSelectProps {
    combinedModels: string[];
    selectedModel: string;
    onModelChange: (e: ChangeEvent<HTMLSelectElement>) => void;
}

export interface AIParametersProps {
    temperature: number;
    randomSeed: number;
    modelList: string[];
    textEmbedding: string;
    onTemperatureChange: (newTemperature: number) => void;
    onRandomSeedChange: (newSeed: number) => void;
    onTextEmbeddingChange: (newEmbedding: string) => void;
    onModelListChange: (newModelList: string[]) => void;
}

export interface PullProgressProps {
    pullLoading: boolean;
    pullProgress: number;
    pullStatus: string;
}

export interface SearchMetadataProps {
    ollamaInput: string;
    setOllamaInput: (value: string) => void;
    handleSearchMetadata: () => void;
    handleClearSearch: () => void;
    searchLoading: boolean;
    metadata: Metadata | null;
    metadataError: string;
    pullLoading: boolean;
    handlePullModel: (tag: string) => void;
    pullingModelName: string;
    downloadedModels: any[];
}

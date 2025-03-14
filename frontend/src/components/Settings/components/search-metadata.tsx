import React, { ChangeEvent } from 'react';

interface Tag {
    tag: string;
    size: string;
    updated: string;
}

interface MainModel {
    name: string;
    description: string;
}

export interface Metadata {
    main_model: MainModel;
    tags: Tag[];
}

interface SearchMetadataProps {
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

const SearchMetadata: React.FC<SearchMetadataProps> = ({
    ollamaInput,
    setOllamaInput,
    handleSearchMetadata,
    handleClearSearch,
    searchLoading,
    metadata,
    metadataError,
    pullLoading,
    handlePullModel,
    pullingModelName,
    downloadedModels
}) => {
    const getButtonProps = (tag: string) => {
        const fullModelName = `${metadata!.main_model.name}:${tag}`;
        const isDownloaded = downloadedModels.some((m) => m.name === fullModelName);
        const isPulling = pullLoading && pullingModelName === fullModelName;
        const isOtherPulling = pullLoading && pullingModelName !== fullModelName;

        if (isDownloaded) {
            return {
                text: 'Model Pulled',
                disabled: true,
                className: 'bg-gray-400 text-white cursor-not-allowed'
            };
        } else if (isPulling) {
            return {
                text: 'Pulling...',
                disabled: true,
                className: 'bg-blue-500 text-white cursor-wait'
            };
        } else if (isOtherPulling) {
            return {
                text: 'Pull Model',
                disabled: true,
                className: 'bg-green-300 text-white cursor-not-allowed'
            };
        } else {
            return {
                text: 'Pull Model',
                disabled: false,
                className: 'bg-green-500 text-white hover:bg-green-600'
            };
        }
    };

    return (
        <div className="mb-4">
            <h3 className="text-xl font-bold mb-2">Search Model Metadata from Ollama</h3>
            <div className="flex mb-2">
                <input
                    type="text"
                    value={ollamaInput}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setOllamaInput(e.target.value)}
                    placeholder="Enter model name to search (e.g., nuextract)"
                    className="flex-1 p-2 border border-gray-300 rounded mr-2"
                />
                <button
                    onClick={handleSearchMetadata}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none"
                    disabled={searchLoading}>
                    {searchLoading ? 'Searching...' : 'Search'}
                </button>
                <button
                    onClick={handleClearSearch}
                    className="ml-2 px-4 py-2 bg-gray-300 text-black rounded hover:bg-gray-400 focus:outline-none"
                    disabled={searchLoading}>
                    Clear Search
                </button>
            </div>
            {metadataError && (
                <div className="p-4 bg-red-100 text-red-600 rounded">{metadataError}</div>
            )}
            {metadata && (
                <div className="border p-4 rounded">
                    <h4 className="text-lg font-bold">Main Model Details</h4>
                    <p>
                        <strong>Name:</strong> {metadata.main_model.name}
                    </p>
                    <p>
                        <strong>Description:</strong> {metadata.main_model.description}
                    </p>
                    <h4 className="text-lg font-bold mt-4">Available Tags</h4>
                    <ul>
                        {metadata.tags.map((tagObj) => {
                            const { text, disabled, className } = getButtonProps(tagObj.tag);
                            return (
                                <li
                                    key={tagObj.tag}
                                    className="flex items-center justify-between border p-2 my-1 rounded">
                                    <div>
                                        <p>
                                            <strong>Tag:</strong> {tagObj.tag}
                                        </p>
                                        <p>
                                            <strong>Size:</strong> {tagObj.size}
                                        </p>
                                        <p>
                                            <strong>Updated:</strong> {tagObj.updated}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => handlePullModel(tagObj.tag)}
                                        className={`px-3 py-1 rounded focus:outline-none ${className}`}
                                        disabled={disabled}>
                                        {text}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default SearchMetadata;

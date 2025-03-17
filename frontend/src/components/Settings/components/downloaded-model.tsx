import React from 'react';
import { DownloadedModelsProps } from '../../../types/Settings/props';

const DownloadedModels: React.FC<DownloadedModelsProps> = ({
    downloadedModels,
    downloadedModelsLoading,
    handleDeleteDownloadedModel
}) => {
    return (
        <div className="mb-4">
            <h3 className="text-xl font-bold mb-2">Ollama Downloaded Models</h3>
            {downloadedModelsLoading ? (
                <div>Loading downloaded models...</div>
            ) : downloadedModels.length > 0 ? (
                <ul className="border p-4 rounded">
                    {downloadedModels.map((modelObj) => (
                        <li
                            key={modelObj.digest || modelObj.name}
                            className="flex items-center justify-between py-1">
                            <span>{modelObj.name}</span>
                            <button
                                onClick={() => handleDeleteDownloadedModel(modelObj)}
                                className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 focus:outline-none">
                                Delete
                            </button>
                        </li>
                    ))}
                </ul>
            ) : (
                <p>No downloaded models found.</p>
            )}
        </div>
    );
};

export default DownloadedModels;

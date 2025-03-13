import React, { ChangeEvent } from 'react';

interface ModelSelectProps {
    combinedModels: string[];
    selectedModel: string;
    onModelChange: (e: ChangeEvent<HTMLSelectElement>) => void;
}

const ModelSelect: React.FC<ModelSelectProps> = ({
    combinedModels,
    selectedModel,
    onModelChange
}) => {
    return (
        <div className="mb-4">
            <label className="block mb-2 font-medium">Select Model</label>
            <select
                value={selectedModel}
                onChange={onModelChange}
                className="w-full p-2 border border-gray-300 rounded">
                {combinedModels.map((model) => (
                    <option key={model} value={model}>
                        {model}
                    </option>
                ))}
            </select>
        </div>
    );
};

export default ModelSelect;

import React from 'react';
import { ModelSelectProps } from '../../../types/Settings/props';

const ModelSelect: React.FC<ModelSelectProps> = ({
    combinedModels,
    selectedModel,
    onModelChange
}) => {
    const actualSelectedModel = combinedModels.includes(selectedModel) ? selectedModel : '';

    return (
        <div className="mb-4">
            <label className="block mb-2 font-medium">Select Model</label>
            <select
                value={actualSelectedModel}
                onChange={onModelChange}
                className="w-full p-2 border border-gray-300 rounded">
                <option value="">Select a model</option>
                {combinedModels.map((model) => {
                    const [provider, ...name] = model.split('-');
                    return (
                        <option key={model} value={model}>
                            {provider[0].toUpperCase() + provider.slice(1)} - {name.join('-')}
                        </option>
                    );
                })}
            </select>
        </div>
    );
};

export default ModelSelect;

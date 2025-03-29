import React, { ChangeEvent } from 'react';
import { ModelSelectProps } from '../../../types/Settings/props';

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

import React, { FC, useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaPlus, FaTrash } from 'react-icons/fa';
import { useApi } from '../../../hooks/Shared/use-api';
import { REMOTE_SERVER_ROUTES } from '../../../constants/Shared';
import { debounce } from 'lodash';
import { AIParametersProps } from '../../../types/Settings/props';

const AIParameters: FC<AIParametersProps> = ({
    temperature,
    randomSeed,
    modelList,
    textEmbedding,
    onTemperatureChange,
    onRandomSeedChange,
    onTextEmbeddingChange,
    onModelListChange
}) => {
    const { fetchData } = useApi();
    const [newModelInput, setNewModelInput] = useState('');
    const [embeddingInput, setEmbeddingInput] = useState(textEmbedding);
    const [embeddingError, setEmbeddingError] = useState<string | null>(null);
    const [modelError, setModelError] = useState<string | null>(null);
    const [localTemperature, setLocalTemperature] = useState(temperature);
    const [isCheckingModel, setIsCheckingModel] = useState(false);

    useEffect(() => {
        setLocalTemperature(temperature);
        setEmbeddingInput(textEmbedding);
    }, [temperature, textEmbedding]);

    const handleCheckAndAddEmbedding = async () => {
        const { data, error } = await fetchData(REMOTE_SERVER_ROUTES.CHECK_GOOGLE_TEXT_EMBEDDING, {
            method: 'POST',
            body: JSON.stringify({ name: embeddingInput })
        });
        if (error) {
            setEmbeddingError('This is invalid');
        } else {
            onTextEmbeddingChange(embeddingInput);
            setEmbeddingError(null);
        }
    };

    const debouncedUpdateTemperature = useCallback(
        debounce((newTemperature: number) => {
            onTemperatureChange(newTemperature);
        }, 300),
        [onTemperatureChange]
    );

    const handleTemperatureChangeInternal = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newTemperature = parseFloat(e.target.value);
        setLocalTemperature(newTemperature);
        debouncedUpdateTemperature(newTemperature);
    };

    const handleAddModel = async () => {
        setModelError(null);
        const newModel = `google-${newModelInput.trim()}`;
        if (!newModelInput.trim() || modelList.includes(newModel)) return;

        setIsCheckingModel(true);
        try {
            const { data, error } = await fetchData(REMOTE_SERVER_ROUTES.CHECK_GOOGLE_MODEL, {
                method: 'POST',
                body: JSON.stringify({ name: newModelInput })
            });
            if (!error) {
                onModelListChange([...modelList, newModel]);
                setNewModelInput('');
            } else {
                setModelError('Invalid model');
            }
        } finally {
            setIsCheckingModel(false);
        }
    };

    return (
        <div className="my-4">
            <div className="flex justify-between items-center">
                <label className="font-medium">Temperature</label>
                <span>{temperature.toFixed(2)}</span>
            </div>
            <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={localTemperature}
                onChange={handleTemperatureChangeInternal}
                className="w-full mt-1 custom-range"
            />
            <div className="mt-4">
                <label className="block font-medium">Random Seed:</label>
                <input
                    type="number"
                    min="0"
                    step="1"
                    value={randomSeed}
                    onChange={(e) => onRandomSeedChange(parseInt(e.target.value) || 0)}
                    className="mt-1 border rounded p-2 w-24"
                />
            </div>
            <div className="mt-4">
                <label className="block font-medium">Text Embedding:</label>
                <div className="flex items-center">
                    <input
                        type="text"
                        value={embeddingInput}
                        onChange={(e) => {
                            setEmbeddingInput(e.target.value);
                            setEmbeddingError(null);
                        }}
                        className="mt-1 border rounded p-2 w-fit min-w-64"
                    />
                    <button
                        onClick={handleCheckAndAddEmbedding}
                        className="ml-2 p-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">
                        Check and Update
                    </button>
                </div>
                {embeddingError && <p className="text-red-500 mt-1">Invalid text embedding</p>}
            </div>
            <div className="mt-4">
                <h4 className="font-semibold">Model List</h4>
                <ul className="space-y-2 mt-2">
                    <AnimatePresence>
                        {modelList.map((model, index) => (
                            <motion.li
                                key={model}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="flex justify-between items-center p-2 rounded shadow">
                                <span>{model.split('-').slice(1).join('-')}</span>
                                <button
                                    onClick={() => {
                                        const newList = modelList.filter((_, i) => i !== index);
                                        onModelListChange(newList);
                                    }}
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
                        placeholder="Add Gemini new model"
                        value={newModelInput}
                        onChange={(e) => setNewModelInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddModel();
                        }}
                        className="border rounded p-2 w-full"
                    />
                    <button
                        onClick={handleAddModel}
                        disabled={isCheckingModel}
                        className={`ml-2 p-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors ${
                            isCheckingModel ? 'opacity-50 cursor-not-allowed' : ''
                        }`}>
                        {isCheckingModel ? (
                            <span className="flex items-center">
                                <span className="animate-spin mr-1">⏳</span> Checking...
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
};

export default AIParameters;

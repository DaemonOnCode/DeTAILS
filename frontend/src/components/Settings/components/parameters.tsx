import React from 'react';
import { useSettings } from '../../../context/settings-context';
import { motion, AnimatePresence } from 'framer-motion';
import { FaPlus, FaTrash, FaTemperatureHigh } from 'react-icons/fa';

const AIParameters: React.FC = () => {
    const { settings, updateSettings } = useSettings();
    const ai = settings.ai || {};
    const temperature = ai.temperature ?? 0.0;
    const randomSeed = ai.randomSeed ?? 0;
    const modelList = ai.modelList ?? [];
    const textEmbedding = ai.textEmbedding ?? '';

    return (
        <div className="my-4">
            <div className="flex justify-between items-center">
                <label className="font-medium">Temperature</label>
                <span className="">{temperature.toFixed(2)}</span>
            </div>
            <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={temperature}
                onChange={(e) => updateSettings('ai', { temperature: parseFloat(e.target.value) })}
                className="w-full mt-1 custom-range"
            />

            {/* Random Seed Input */}
            <div className="mt-4">
                <label className="block font-medium">Random Seed:</label>
                <input
                    type="number"
                    min="0"
                    step="1"
                    value={randomSeed}
                    onChange={(e) =>
                        updateSettings('ai', { randomSeed: parseInt(e.target.value) || 0 })
                    }
                    className="mt-1 border rounded p-2 w-24"
                />
            </div>

            {/* Text Embedding Input */}
            <div className="mt-4">
                <label className="block font-medium">Text Embedding:</label>
                <input
                    type="text"
                    value={textEmbedding}
                    onChange={(e) => updateSettings('ai', { textEmbedding: e.target.value })}
                    className="mt-1 border rounded p-2 w-full"
                />
            </div>

            {/* Model List Management */}
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
                                <span className="">{model.split('-').slice(1).join('-')}</span>
                                <button
                                    onClick={() => {
                                        const newList = modelList.filter((_, i) => i !== index);
                                        updateSettings('ai', { modelList: newList });
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
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                const newModelInput = e.currentTarget.value.trim();
                                if (newModelInput) {
                                    const newModel = `google-${newModelInput}`;
                                    if (!modelList.includes(newModel)) {
                                        updateSettings('ai', {
                                            modelList: [...modelList, newModel]
                                        });
                                        e.currentTarget.value = ''; // Clear input after adding
                                    }
                                }
                            }
                        }}
                        className="border rounded p-2 w-full"
                    />
                    <button
                        onClick={() => {
                            const input = document.querySelector(
                                'input[placeholder="Add Gemini new model"]'
                            ) as HTMLInputElement;
                            const newModelInput = input.value.trim();
                            if (newModelInput) {
                                const newModel = `google-${newModelInput}`;
                                if (!modelList.includes(newModel)) {
                                    updateSettings('ai', { modelList: [...modelList, newModel] });
                                    input.value = ''; // Clear input after adding
                                }
                            }
                        }}
                        className="ml-2 p-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors">
                        <FaPlus />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AIParameters;

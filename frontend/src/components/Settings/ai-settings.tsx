import React, { useState, useEffect } from 'react';
import { useSettings } from '../../context/settings-context';
import { MODEL_LIST } from '../../constants/Shared';

const AISettings = () => {
    const { settings, updateSettings } = useSettings();
    const { ai } = settings;
    const [googleCredentialsPath, setGoogleCredentialsPath] = useState<string>(
        ai?.googleCredentialsPath || ''
    );
    const [selectedModel, setSelectedModel] = useState<string>(
        ai?.model || MODEL_LIST.GEMINI_FLASH_THINKING
    );

    // Update local state if the context settings change.
    useEffect(() => {
        setGoogleCredentialsPath(ai?.googleCredentialsPath || '');
        setSelectedModel(ai?.model || MODEL_LIST.GEMINI_FLASH_THINKING);
    }, [ai]);

    useEffect(() => {
        console.log('Selected model:', selectedModel);
    }, [selectedModel]);

    const handleCredentialsPathChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // await updateSettings('ai', { googleCredentialsPath: e.target.value, model: selectedModel });
        setGoogleCredentialsPath(e.target.value);
    };

    const handleModelChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        await updateSettings('ai', { googleCredentialsPath, model: e.target.value });
        setSelectedModel(e.target.value);
    };

    const handleUpdateAISettings = async () => {
        await updateSettings('ai', { googleCredentialsPath, model: selectedModel });
    };

    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">AI Settings</h2>
            <div className="mb-4">
                <label className="block mb-2 font-medium">Google Credentials Path</label>
                <input
                    type="text"
                    value={googleCredentialsPath}
                    onChange={handleCredentialsPathChange}
                    className="w-full p-2 border border-gray-300 rounded"
                    placeholder="Enter path to Google credentials file"
                />
            </div>
            <button
                onClick={handleUpdateAISettings}
                className="px-4 py-2 mb-4 bg-green-500 text-white rounded hover:bg-green-600 focus:outline-none">
                Update Google Credentials path
            </button>
            <div className="mb-4">
                <label className="block mb-2 font-medium">Select Model</label>
                <select
                    value={selectedModel}
                    onChange={handleModelChange}
                    className="w-full p-2 border border-gray-300 rounded">
                    {Object.values(MODEL_LIST).map((model) => (
                        <option key={model} value={model}>
                            {model}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
};

export default AISettings;

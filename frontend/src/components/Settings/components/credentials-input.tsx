import React, { ChangeEvent } from 'react';

interface CredentialsInputProps {
    googleCredentialsPath: string;
    handleCredentialsPathChange: (e: ChangeEvent<HTMLInputElement>) => void;
    handleUpdateAISettings: () => void;
}

const CredentialsInput: React.FC<CredentialsInputProps> = ({
    googleCredentialsPath,
    handleCredentialsPathChange,
    handleUpdateAISettings
}) => {
    return (
        <div className="mb-4">
            <label className="block mb-2 font-medium">Google Credentials Path</label>
            <input
                type="text"
                value={googleCredentialsPath}
                onChange={handleCredentialsPathChange}
                className="w-full p-2 border border-gray-300 rounded"
                placeholder="Enter path to Google credentials file"
            />
            <button
                onClick={handleUpdateAISettings}
                className="px-4 py-2 mt-2 bg-green-500 text-white rounded hover:bg-green-600 focus:outline-none">
                Update Google Credentials path
            </button>
        </div>
    );
};

export default CredentialsInput;

import React, { ChangeEvent } from 'react';
import { CredentialsInputProps } from '../../../types/Settings/props';

const CredentialsInput: React.FC<CredentialsInputProps> = ({
    googleCredentialsPath,
    onCredentialsPathChange
}) => {
    return (
        <div className="mb-4">
            <label className="block mb-2 font-medium">Google Credentials Path</label>
            <input
                type="text"
                value={googleCredentialsPath}
                onChange={onCredentialsPathChange}
                className="w-full p-2 border border-gray-300 rounded"
                placeholder="Enter path to Google credentials file"
            />
        </div>
    );
};

export default CredentialsInput;

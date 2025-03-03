import React, { useState, useEffect } from 'react';
import { useSettings } from '../../context/settings-context';

const TransmissionSettings = () => {
    const { settings, updateSettings } = useSettings();
    // Assume settings contains a transmission object with a "path" property.
    const { transmission } = settings;
    const [transmissionPath, setTransmissionPath] = useState<string>(transmission?.path || '');

    // Update local state if the context settings change.
    useEffect(() => {
        setTransmissionPath(transmission?.path || '');
    }, [transmission]);

    const handlePathChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTransmissionPath(e.target.value);
    };

    const handleUpdatePath = async () => {
        await updateSettings('transmission', { path: transmissionPath });
    };

    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">Transmission Settings</h2>
            <div className="mb-4">
                <label className="block mb-2 font-medium">Transmission Executable Path</label>
                <input
                    type="text"
                    value={transmissionPath}
                    onChange={handlePathChange}
                    className="w-full p-2 border border-gray-300 rounded"
                    placeholder="Enter Transmission CLI path"
                />
            </div>
            <button
                onClick={handleUpdatePath}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 focus:outline-none">
                Update Transmission Path
            </button>
        </div>
    );
};

export default TransmissionSettings;

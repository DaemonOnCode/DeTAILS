import React, { useState, useEffect, FC } from 'react';
import { useSettings } from '../../../context/settings-context';
import { CommonSettingTabProps } from '../../../types/Settings/props';

const TransmissionSettings: FC<CommonSettingTabProps> = ({ setSaveCurrentSettings }) => {
    const { settings, updateSettings, markSectionDirty } = useSettings();
    const { transmission } = settings;
    const [localTransmission, setLocalTransmission] = useState({
        path: transmission?.path || '',
        downloadDir: transmission?.downloadDir || ''
    });

    // Sync local state with context settings
    useEffect(() => {
        setLocalTransmission({
            path: transmission?.path || '',
            downloadDir: transmission?.downloadDir || ''
        });
    }, [transmission]);

    // Provide the save function to the parent
    useEffect(() => {
        setSaveCurrentSettings(() => () => updateSettings('transmission', localTransmission));
    }, [localTransmission, updateSettings, setSaveCurrentSettings]);

    const handlePathChange = (e: any) => {
        setLocalTransmission((prev) => ({ ...prev, path: e.target.value }));
        markSectionDirty('transmission', true);
    };

    const handleDownloadDirChange = (e: any) => {
        setLocalTransmission((prev) => ({ ...prev, downloadDir: e.target.value }));
        markSectionDirty('transmission', true);
    };

    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">Transmission Settings</h2>
            <div className="mb-4">
                <label className="block mb-2 font-medium">Transmission Executable Path</label>
                <input
                    type="text"
                    value={localTransmission.path}
                    onChange={handlePathChange}
                    className="w-full p-2 border border-gray-300 rounded"
                    placeholder="Enter Transmission CLI path"
                />
            </div>
            <div className="mb-4">
                <label className="block mb-2 font-medium">Transmission Download Path</label>
                <input
                    type="text"
                    value={localTransmission.downloadDir}
                    onChange={handleDownloadDirChange}
                    className="w-full p-2 border border-gray-300 rounded"
                    placeholder="Enter Transmission download folder path"
                />
            </div>
        </div>
    );
};

export default TransmissionSettings;

import React, { useState, useEffect, FC } from 'react';
import { useSettings } from '../../../context/settings-context';
import { CommonSettingTabProps } from '../../../types/Settings/props';

const TransmissionSettings: FC<CommonSettingTabProps> = ({ setSaveCurrentSettings }) => {
    const { settings, updateSettings, markSectionDirty } = useSettings();
    const { transmission } = settings;

    const [localTransmission, setLocalTransmission] = useState({
        path: transmission?.path || '',
        downloadDir: transmission?.downloadDir || '',
        magnetLink: transmission?.magnetLink || ''
    });

    useEffect(() => {
        setLocalTransmission({
            path: transmission?.path || '',
            downloadDir: transmission?.downloadDir || '',
            magnetLink: transmission?.magnetLink || ''
        });
    }, [transmission]);

    useEffect(() => {
        setSaveCurrentSettings(() => () => updateSettings('transmission', localTransmission));
    }, [localTransmission, updateSettings, setSaveCurrentSettings]);

    const handlePathChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalTransmission((prev) => ({ ...prev, path: e.target.value }));
        markSectionDirty('transmission', true);
    };

    const handleDownloadDirChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalTransmission((prev) => ({ ...prev, downloadDir: e.target.value }));
        markSectionDirty('transmission', true);
    };

    const handleMagnetLinkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalTransmission((prev) => ({ ...prev, magnetLink: e.target.value }));
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
            <div className="mb-4">
                <label className="block mb-2 font-medium">Academic Torrent Magnet link</label>
                <input
                    type="text"
                    value={localTransmission.magnetLink}
                    onChange={handleMagnetLinkChange}
                    className="w-full p-2 border border-gray-300 rounded"
                    placeholder="Enter magnet link (e.g., magnet:?xt=urn:btih:...)"
                />
            </div>
        </div>
    );
};

export default TransmissionSettings;

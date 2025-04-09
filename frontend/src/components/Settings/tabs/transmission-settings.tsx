import React, { useState, useEffect, FC } from 'react';
import { useSettings } from '../../../context/settings-context';
import { CommonSettingTabProps } from '../../../types/Settings/props';

const { ipcRenderer } = window.require('electron');

const TransmissionSettings: FC<CommonSettingTabProps> = ({ setSaveCurrentSettings }) => {
    const { settings, updateSettings, markSectionDirty } = useSettings();
    const { transmission } = settings;

    const [localTransmission, setLocalTransmission] = useState({
        path: transmission?.path || '',
        downloadDir: transmission?.downloadDir || '',
        magnetLink: transmission?.magnetLink || '',
        fallbackMagnetLink: transmission?.fallbackMagnetLink || ''
    });

    useEffect(() => {
        setLocalTransmission({
            path: transmission?.path || '',
            downloadDir: transmission?.downloadDir || '',
            magnetLink: transmission?.magnetLink || '',
            fallbackMagnetLink: transmission?.fallbackMagnetLink || ''
        });
    }, [transmission]);

    useEffect(() => {
        setSaveCurrentSettings(() => () => updateSettings('transmission', localTransmission));
    }, [localTransmission, updateSettings, setSaveCurrentSettings]);

    const handleSelectFolder = async () => {
        const folderPath = await ipcRenderer.invoke('select-folder');
        if (folderPath) {
            setLocalTransmission((prev) => ({ ...prev, downloadDir: folderPath }));
            markSectionDirty('transmission', true);
        }
    };

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

    const handleFallbackMagnetLinkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalTransmission((prev) => ({ ...prev, fallbackMagnetLink: e.target.value }));
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
                <div className="flex">
                    <input
                        type="text"
                        value={localTransmission.downloadDir}
                        onChange={handleDownloadDirChange}
                        className="flex-grow p-2 border border-gray-300 rounded-l"
                        placeholder="Enter or select Transmission download folder"
                    />
                    <button
                        onClick={handleSelectFolder}
                        className="p-2 bg-blue-500 text-white rounded-r">
                        Select Folder
                    </button>
                </div>
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
            <div>
                <label className="block mb-1 font-medium">
                    Fallback Academic Torrent Magnet Link
                </label>
                <input
                    type="text"
                    value={localTransmission.fallbackMagnetLink}
                    onChange={handleFallbackMagnetLinkChange}
                    className="w-full p-2 border border-gray-300 rounded"
                    placeholder="Enter fallback magnet link (e.g., magnet:?xt=urn:btih:...)"
                />
            </div>
        </div>
    );
};

export default TransmissionSettings;

import React, { useState, useEffect, FC } from 'react';
import { useSettings } from '../../../context/settings-context';
import { CommonSettingTabProps } from '../../../types/Settings/props';

const GeneralSettings: FC<CommonSettingTabProps> = ({ setSaveCurrentSettings }) => {
    const { settings, updateSettings, markSectionDirty } = useSettings();
    const { general } = settings;
    const [localGeneral, setLocalGeneral] = useState(general);

    // Sync local state with context settings
    useEffect(() => {
        setLocalGeneral(general);
    }, [general]);

    // Provide the save function to the parent
    useEffect(() => {
        setSaveCurrentSettings(() => () => updateSettings('general', localGeneral));
    }, [localGeneral, updateSettings, setSaveCurrentSettings]);

    const handleThemeChange = (e: any) => {
        setLocalGeneral((prev) => ({ ...prev, theme: e.target.value }));
        markSectionDirty('general', true);
    };

    return (
        <div>
            <h2 className="text-2xl font-bold mb-4">General Settings</h2>
            <div className="mb-4">
                <label className="flex items-center space-x-2">
                    <input
                        type="checkbox"
                        checked={localGeneral.manualCoding}
                        onChange={(e) => {
                            setLocalGeneral((prev) => ({
                                ...prev,
                                manualCoding: e.target.checked
                            }));
                            markSectionDirty('general', true);
                        }}
                        className="form-checkbox"
                    />
                    <span>Show Manual coding</span>
                </label>
            </div>
            <div className="mb-4">
                <div className="flex justify-between items-center">
                    <label className="font-medium">Sample Ratio</label>
                    <span>{localGeneral.sampleRatio.toFixed(2)}</span>
                </div>
                <input
                    type="range"
                    min="0.01"
                    max="0.99"
                    step="0.01"
                    value={localGeneral.sampleRatio}
                    onChange={(e) => {
                        const newValue = parseFloat(e.target.value);
                        setLocalGeneral((prev) => ({ ...prev, sampleRatio: newValue }));
                        markSectionDirty('general', true);
                    }}
                    className="w-full mt-1 custom-range"
                />
            </div>
            {/* Uncomment and update if needed */}
            {/* <div className="mb-4">
                <label className="mr-2">Theme:</label>
                <select
                    value={localGeneral.theme}
                    onChange={handleThemeChange}
                    className="border rounded p-1"
                >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                </select>
            </div> */}
        </div>
    );
};

export default GeneralSettings;

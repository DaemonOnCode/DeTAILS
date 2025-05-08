import React, { useState, useEffect, FC } from 'react';
import { useSettings } from '../../../context/settings-context';
import { CommonSettingTabProps } from '../../../types/Settings/props';

const GeneralSettings: FC<CommonSettingTabProps> = ({ setSaveCurrentSettings }) => {
    const { settings, updateSettings, markSectionDirty } = useSettings();
    const { general } = settings;
    const [localGeneral, setLocalGeneral] = useState(general);

    useEffect(() => {
        setLocalGeneral(general);
    }, [general]);

    useEffect(() => {
        setSaveCurrentSettings(() => () => updateSettings('general', localGeneral));
    }, [localGeneral, updateSettings, setSaveCurrentSettings]);

    return (
        <div>
            <h2 className="text-2xl font-bold mb-4">General Settings</h2>
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
        </div>
    );
};

export default GeneralSettings;

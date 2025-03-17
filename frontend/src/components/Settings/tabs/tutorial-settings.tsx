import React, { useState, useEffect, FC } from 'react';
import { useSettings } from '../../../context/settings-context';
import { CommonSettingTabProps } from '../../../types/Settings/props';

const TutorialSettings: FC<CommonSettingTabProps> = ({ setSaveCurrentSettings }) => {
    const { settings, updateSettings, markSectionDirty } = useSettings();
    const { tutorials } = settings;
    const [localTutorials, setLocalTutorials] = useState(tutorials);

    // Sync local state with context settings when they change
    useEffect(() => {
        setLocalTutorials(tutorials);
    }, [tutorials]);

    // Provide the save function to the parent
    useEffect(() => {
        setSaveCurrentSettings(() => () => updateSettings('tutorials', localTutorials));
    }, [localTutorials, updateSettings, setSaveCurrentSettings]);

    const handleShowTutorialsChange = (e: any) => {
        setLocalTutorials((prev) => ({ ...prev, showGlobal: e.target.checked }));
        markSectionDirty('tutorials', true);
    };

    const handleClearSkipPages = () => {
        setLocalTutorials((prev) => ({ ...prev, skipPages: [] }));
        markSectionDirty('tutorials', true);
    };

    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">Tutorial Settings</h2>
            <div className="mb-4">
                <label className="flex items-center space-x-2">
                    <input
                        type="checkbox"
                        checked={localTutorials.showGlobal}
                        onChange={handleShowTutorialsChange}
                        className="form-checkbox"
                    />
                    <span>Show Tutorials Globally</span>
                </label>
            </div>
            <div className="mb-4">
                <p className="font-medium">Skipped Pages:</p>
                {localTutorials.skipPages.length > 0 ? (
                    <ul className="list-disc list-inside ml-4">
                        {localTutorials.skipPages.map((page, index) => (
                            <li key={index}>{page}</li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-gray-500">No pages skipped.</p>
                )}
            </div>
            <button
                onClick={handleClearSkipPages}
                className="px-4 py-2 bg-blue-500 text-white rounded">
                Clear Skipped Pages
            </button>
        </div>
    );
};

export default TutorialSettings;

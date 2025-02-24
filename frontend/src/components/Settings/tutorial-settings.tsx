import React from 'react';
import { useSettings } from '../../context/settings-context';

const TutorialSettings = () => {
    const { settings, updateSettings } = useSettings();
    const { tutorials } = settings;

    const handleShowTutorialsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        updateSettings('tutorials', { showGlobal: e.target.checked });
    };

    const handleClearSkipPages = () => {
        updateSettings('tutorials', { skipPages: [] });
    };

    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">Tutorial Settings</h2>
            <div className="mb-4">
                <label className="flex items-center space-x-2">
                    <input
                        type="checkbox"
                        checked={tutorials.showGlobal}
                        onChange={handleShowTutorialsChange}
                        className="form-checkbox"
                    />
                    <span>Show Tutorials Globally</span>
                </label>
            </div>
            <div className="mb-4">
                <p className="font-medium">Skipped Pages:</p>
                {tutorials.skipPages.length > 0 ? (
                    <ul className="list-disc list-inside ml-4">
                        {tutorials.skipPages.map((page, index) => (
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

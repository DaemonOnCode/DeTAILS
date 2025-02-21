// DevtoolsSettings.tsx
import React from 'react';
import { useSettings } from '../../context/settings-context';

const DevtoolsSettings = () => {
    const { settings, updateSettings } = useSettings();
    const { devtools } = settings;

    const handleShowConsoleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        updateSettings('devtools', { showConsole: e.target.checked });
    };

    const handleRemoteDebuggingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        updateSettings('devtools', { enableRemoteDebugging: e.target.checked });
    };

    return (
        <div>
            <h2 className="text-2xl font-bold mb-4">DevTools Settings</h2>
            {/* <div className="mb-4">
                <label className="flex items-center space-x-2">
                    <input
                        type="checkbox"
                        checked={devtools.showConsole}
                        onChange={handleShowConsoleChange}
                    />
                    <span>Show Console</span>
                </label>
            </div>
            <div className="mb-4">
                <label className="flex items-center space-x-2">
                    <input
                        type="checkbox"
                        checked={devtools.enableRemoteDebugging}
                        onChange={handleRemoteDebuggingChange}
                    />
                    <span>Enable Remote Debugging</span>
                </label>
            </div> */}
        </div>
    );
};

export default DevtoolsSettings;

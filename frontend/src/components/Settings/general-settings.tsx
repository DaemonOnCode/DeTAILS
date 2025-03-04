import { ChangeEvent } from 'react';
import { useSettings } from '../../context/settings-context';

const GeneralSettings = () => {
    const { settings, updateSettings } = useSettings();
    const { general } = settings;

    const handleThemeChange = (e: ChangeEvent<HTMLSelectElement>) => {
        updateSettings('general', { ...general, theme: e.target.value as 'light' | 'dark' });
    };

    return (
        <div>
            <h2 className="text-2xl font-bold mb-4">General Settings</h2>
            <div className="mb-4">
                <label className="flex items-center space-x-2">
                    <input
                        type="checkbox"
                        checked={general.manualCoding}
                        onChange={(e) =>
                            updateSettings('general', {
                                ...general,
                                manualCoding: e.target.checked
                            })
                        }
                        className="form-checkbox"
                    />
                    <span>Show Manual coding</span>
                </label>
            </div>
            {/* <div className="mb-4">
                <label className="mr-2">Theme:</label>
                <select
                    value={general.theme}
                    onChange={handleThemeChange}
                    className="border rounded p-1">
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                </select>
            </div> */}
        </div>
    );
};

export default GeneralSettings;

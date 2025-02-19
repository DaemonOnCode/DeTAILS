import { ChangeEvent } from 'react';
import { useSettings } from '../../context/settings-context';

const WorkspaceSettings = () => {
    const { settings, updateSettings } = useSettings();
    const { workspace } = settings;

    const handleLayoutChange = (e: ChangeEvent<HTMLSelectElement>) => {
        updateSettings('workspace', { ...workspace, layout: e.target.value as 'grid' | 'list' });
    };

    return (
        <div>
            <h2 className="text-2xl font-bold mb-4">Workspace Settings</h2>
            <div className="mb-4">
                <label className="mr-2">Layout:</label>
                <select
                    value={workspace.layout}
                    onChange={handleLayoutChange}
                    className="border rounded p-1">
                    <option value="grid">Grid</option>
                    <option value="list">List</option>
                </select>
            </div>
        </div>
    );
};

export default WorkspaceSettings;

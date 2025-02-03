import { useState } from 'react';
import DiagramPanel from './diagram-panel';
import { useModelingContext } from '../../context/modeling-context';

const RightPanel = () => {
    const [plotType, setPlotType] = useState('chord');
    const { models, activeModelId } = useModelingContext();
    const currentModel = models.find((model) => model.id === activeModelId);
    console.log('Current Model:', currentModel);

    if (!currentModel) return <></>;

    // Determine plot types based on model type
    const plotTypes = currentModel.type === 'bertopic' ? ['chord', 'hierarchy'] : ['chord'];

    return (
        <div className="w-2/3 p-4 h-full overflow-auto">
            <div className="mb-4">
                <label htmlFor="plot-type" className="mr-2 font-medium text-gray-800">
                    Select Plot Type:
                </label>
                <select
                    id="plot-type"
                    value={plotType}
                    onChange={(e) => setPlotType(e.target.value)}
                    className="px-4 py-2 rounded border border-gray-300 focus:outline-none focus:ring focus:ring-blue-300">
                    {plotTypes.map((type) => (
                        <option key={type} value={type}>
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                        </option>
                    ))}
                </select>
            </div>
            {plotType === 'chord' ? <DiagramPanel /> : <h1>Hierarchy Diagram (For Bertopic)</h1>}
        </div>
    );
};

export default RightPanel;

import { useState } from 'react';
import { useModelingContext } from '../../context/modeling_context';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants/DataModeling/shared';
import { ROUTES as SHARED_ROUTES } from '../../constants/Shared';

const Topbar = () => {
    const { models, activeModelId, setActiveModelId, updateModelName, removeModel } =
        useModelingContext();
    const [isEditing, setIsEditing] = useState(false);
    const [editModelId, setEditModelId] = useState<string | null>(null);
    const [newName, setNewName] = useState('');

    const navigate = useNavigate();

    const handleEdit = (modelId: string) => {
        setIsEditing(true);
        setEditModelId(modelId);
        setNewName(models.find((model) => model.id === modelId)?.name || '');
    };

    const handleSaveEdit = () => {
        if (editModelId) {
            updateModelName(editModelId, newName);
        }
        setIsEditing(false);
        setEditModelId(null);
    };

    const handleAddNewModel = () => {
        navigate(`/${SHARED_ROUTES.DATA_MODELING}/${ROUTES.HOME}`);
    };

    return (
        <div className="bg-gray-100 flex items-center px-2 pt-2">
            {models.map((model) => (
                <div
                    key={model.id}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-t-lg transition-all cursor-pointer ${
                        model.id === activeModelId
                            ? 'bg-white text-gray-800'
                            : 'bg-gray-300 text-gray-700 hover:bg-gray-200'
                    }`}
                    onClick={() => setActiveModelId(model.id)}>
                    {isEditing && model.id === editModelId ? (
                        <div className="flex items-center space-x-2">
                            <input
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                className="text-gray-800 px-2 py-1 rounded w-24 border border-gray-300"
                                autoFocus
                            />
                            <button
                                onClick={handleSaveEdit}
                                className="text-blue-500 hover:text-blue-700">
                                Save
                            </button>
                        </div>
                    ) : (
                        <>
                            <span className="truncate">{model.name}</span>
                            {model.isProcessing && <span className="ml-1">🔄</span>}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleEdit(model.id);
                                }}
                                className="text-yellow-500 hover:text-yellow-700">
                                ✏️
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    removeModel(model.id);
                                }}
                                className="text-red-500 hover:text-red-700">
                                ❌
                            </button>
                        </>
                    )}
                </div>
            ))}
            <button
                onClick={handleAddNewModel}
                className="flex items-center bg-blue-500 text-white px-4 py-2 rounded-t-lg shadow-md hover:bg-blue-600 transition">
                ➕
            </button>
        </div>
    );
};

export default Topbar;

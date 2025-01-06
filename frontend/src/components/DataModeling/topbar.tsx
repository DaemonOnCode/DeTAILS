import { useState } from 'react';
import { useModelingContext } from '../../context/modeling_context';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants/DataModeling/shared';
import { REMOTE_SERVER_ROUTES, ROUTES as SHARED_ROUTES } from '../../constants/Shared';
import useServerUtils from '../../hooks/Shared/get_server_url';
import { toast } from 'react-toastify';
import { useWorkspaceContext } from '../../context/workspace_context';
import { useCollectionContext } from '../../context/collection_context';

const Topbar = () => {
    const { models, activeModelId, setActiveModelId, updateModelName, removeModel } =
        useModelingContext();
    const [isEditing, setIsEditing] = useState(false);
    const [editModelId, setEditModelId] = useState<string | null>(null);
    const [newName, setNewName] = useState('');

    const { currentWorkspace } = useWorkspaceContext();
    const { datasetId } = useCollectionContext();

    const { getServerUrl } = useServerUtils();

    const navigate = useNavigate();

    const handleEdit = (modelId: string) => {
        setIsEditing(true);
        setEditModelId(modelId);
        setNewName(models.find((model) => model.id === modelId)?.name || '');
    };

    const handleSaveEdit = async () => {
        const res = await fetch(getServerUrl(REMOTE_SERVER_ROUTES.ADD_MODEL), {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model_id: editModelId,
                new_model_name: newName,
                workspace_id: currentWorkspace?.id || '',
                dataset_id: datasetId ?? ''
            })
        });

        if (!res.ok) {
            console.log('Error updating model name');
            toast.error('Error updating model name');
            return;
        }

        if (editModelId) {
            updateModelName(editModelId, newName);
        }
        setIsEditing(false);
        setEditModelId(null);
        toast.success('Model name updated');
    };

    const handleRemoveModel = async (id: string) => {
        const res = await fetch(getServerUrl(REMOTE_SERVER_ROUTES.ADD_MODEL), {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model_id: id,
                workspace_id: currentWorkspace?.id || '',
                dataset_id: datasetId ?? ''
            })
        });

        if (!res.ok) {
            console.log('Error removing model');
            toast.error('Error removing model');
            return;
        }
        removeModel(id);
        toast.success('Model removed');
    };

    const handleAddNewModel = () => {
        navigate(`/${SHARED_ROUTES.DATA_MODELING}/${ROUTES.HOME}`);
    };

    return (
        <div className="bg-gray-100 flex items-center px-2 pt-2 group">
            <div className="flex overflow-x-auto w-full scrollbar-hide group-hover:scrollbar-thin group-hover:scrollbar-thumb-gray-500 group-hover:scrollbar-track-gray-200">
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
                                    onClick={() => {
                                        handleEdit(model.id);
                                    }}
                                    className="text-yellow-500 hover:text-yellow-700">
                                    ✏️
                                </button>
                                <button
                                    onClick={() => {
                                        handleRemoveModel(model.id);
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
        </div>
    );
};

export default Topbar;

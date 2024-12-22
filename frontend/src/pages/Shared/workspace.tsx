import React, { useState } from 'react';
import { useWorkspaceContext } from '../../context/workspace_context';
import { FiFolder, FiFolderPlus, FiChevronDown, FiChevronRight, FiEdit2 } from 'react-icons/fi';
import { BsTrash } from 'react-icons/bs';
import { useNavigate } from 'react-router-dom';
import { ROUTES as DATA_COLLECTION_ROUTES } from '../../constants/DataCollection/shared';
import { ROUTES as SHARED_ROUTES } from '../../constants/Shared';

const WorkspacePage: React.FC = () => {
    const { workspaces, addWorkspace, deleteWorkspace, updateWorkspace, setCurrentWorkspaceById } =
        useWorkspaceContext();

    const navigate = useNavigate();

    const [expanded, setExpanded] = useState<{ [key: string]: boolean }>({});
    const [newWorkspaceName, setNewWorkspaceName] = useState('');
    const [renamingWorkspace, setRenamingWorkspace] = useState<string | null>(null);
    const [renameWorkspaceName, setRenameWorkspaceName] = useState('');

    const toggleExpand = (id: string) => {
        setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    const handleAddWorkspace = () => {
        if (!newWorkspaceName.trim()) {
            alert('Workspace name cannot be empty.');
            return;
        }

        addWorkspace({ id: `${Date.now()}`, name: newWorkspaceName, description: '' });
        setNewWorkspaceName('');
    };

    const handleDeleteWorkspace = (id: string) => {
        deleteWorkspace(id);
    };

    const handleRenameWorkspace = (id: string) => {
        if (!renameWorkspaceName.trim()) {
            alert('Workspace name cannot be empty.');
            return;
        }

        updateWorkspace(id, renameWorkspaceName);
        setRenamingWorkspace(null);
        setRenameWorkspaceName('');
    };

    const handleWorkspaceClick = (workspaceId: string) => {
        if (workspaceId) {
            setCurrentWorkspaceById(workspaceId);
        }
        navigate(`/${SHARED_ROUTES.DATA_COLLECTION}/${DATA_COLLECTION_ROUTES.HOME}`);
    };

    return (
        <div className="h-panel">
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-bold">Workspace Management</h1>
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        placeholder="New Workspace Name"
                        value={newWorkspaceName}
                        onChange={(e) => setNewWorkspaceName(e.target.value)}
                        className="px-3 py-2 border rounded-md text-gray-700"
                    />
                    <button
                        onClick={handleAddWorkspace}
                        className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md flex items-center gap-2">
                        <FiFolderPlus />
                        Add
                    </button>
                </div>
            </div>
            <div className="bg-white shadow-md rounded-lg">
                <div className="p-4 border-b">
                    <h2 className="text-lg font-semibold">All Workspaces</h2>
                </div>
                <div className="p-4">
                    {workspaces.map((workspace) => (
                        <div key={workspace.id} className="mb-2">
                            <div className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-2 rounded">
                                <span onClick={() => toggleExpand(workspace.id)}>
                                    {expanded[workspace.id] ? (
                                        <FiChevronDown className="text-gray-600" />
                                    ) : (
                                        <FiChevronRight className="text-gray-600" />
                                    )}
                                </span>
                                <FiFolder className="text-gray-500" />
                                {renamingWorkspace === workspace.id ? (
                                    <input
                                        type="text"
                                        value={renameWorkspaceName}
                                        onChange={(e) => setRenameWorkspaceName(e.target.value)}
                                        onBlur={() => handleRenameWorkspace(workspace.id)}
                                        className="px-2 py-1 border rounded-md text-gray-700 flex-1"
                                        autoFocus
                                    />
                                ) : (
                                    <span
                                        className="text-gray-800 font-medium flex-1"
                                        onClick={() => handleWorkspaceClick(workspace.id)}>
                                        {workspace.name}
                                    </span>
                                )}
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setRenamingWorkspace(workspace.id);
                                            setRenameWorkspaceName(workspace.name);
                                        }}
                                        className="text-blue-500 hover:text-blue-600">
                                        <FiEdit2 />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteWorkspace(workspace.id);
                                        }}
                                        className="text-red-500 hover:text-red-600">
                                        <BsTrash />
                                    </button>
                                </div>
                            </div>
                            {expanded[workspace.id] && (
                                <div className="ml-6 mt-2">
                                    {/* Example of sub-items or details */}
                                    <p className="text-sm text-gray-600">
                                        Workspace ID: {workspace.id}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                        Description:{' '}
                                        {workspace.description || 'No description available'}
                                    </p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default WorkspacePage;

import React, { useEffect, useRef, useState } from 'react';
import { useWorkspaceContext } from '../../context/workspace-context';
import {
    FiFolder,
    FiFolderPlus,
    FiChevronDown,
    FiChevronRight,
    FiEdit,
    FiTrash2
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { ROUTES as DATA_COLLECTION_ROUTES } from '../../constants/DataCollection/shared';
import { REMOTE_SERVER_ROUTES, ROUTES as SHARED_ROUTES } from '../../constants/Shared';
import useServerUtils from '../../hooks/Shared/get-server-url';
import { useAuth } from '../../context/auth-context';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import { toast } from 'react-toastify';
import { ROUTES as CODING_ROUTES } from '../../constants/Coding/shared';
import { useToast } from '../../context/toast-context';

const { ipcRenderer } = window.require('electron');

const WorkspaceSelectionPage: React.FC = () => {
    // const { workspaces, addWorkspace, deleteWorkspace, updateWorkspace, setCurrentWorkspaceById } =
    //     useWorkspaceContext();
    const { user } = useAuth();

    const { showToast } = useToast();

    const navigate = useNavigate();

    const [expanded, setExpanded] = useState<{ [key: string]: boolean }>({});
    // const [newWorkspaceName, setNewWorkspaceName] = useState('');
    const [renamingWorkspace, setRenamingWorkspace] = useState<string | null>(null);
    // const [renameWorkspaceName, setRenameWorkspaceName] = useState('');
    const [editingDescription, setEditingDescription] = useState<string | null>(null);
    const [newDescription, setNewDescription] = useState<string>('');

    // const { getServerUrl } = useServerUtils();

    const {
        workspaces,
        currentWorkspace,
        addWorkspace,
        setWorkspaces,
        addWorkspaceBatch,
        // setCurrentWorkspace,
        updateWorkspace,
        deleteWorkspace,
        setCurrentWorkspaceById,
        setWorkspaceLoading,
        workspaceLoading: loading
    } = useWorkspaceContext();

    const [newWorkspaceName, setNewWorkspaceName] = useState<string>('');
    // const [renameMode, setRenameMode] = useState<boolean>(false);
    const [renameWorkspaceName, setRenameWorkspaceName] = useState<string>('');

    // const [dropdownVisible, setDropdownVisible] = useState<boolean>(false);

    const { loadWorkspaceData } = useWorkspaceUtils();
    const { getServerUrl } = useServerUtils();

    const handleCreateTempWorkspace = async () => {
        try {
            if (workspaces.some((ws) => ws.name === 'Temporary Workspace')) {
                return; // Skip creating a temporary workspace if one exists
            }

            const response = await fetch(
                getServerUrl(
                    `${REMOTE_SERVER_ROUTES.CREATE_TEMP_WORKSPACE}?user_email=${encodeURIComponent(
                        user?.email || ''
                    )}`
                ),
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                }
            );
            const tempWorkspace = await response.json();

            addWorkspace({ id: tempWorkspace.id, name: 'Temporary Workspace' });
            // setCurrentWorkspaceById(tempWorkspace.id);
        } catch (error) {
            console.error('Error creating temporary workspace:', error);
        }
    };

    const isLoading = useRef(false);

    useEffect(() => {
        const fetchWorkspaces = async () => {
            if (isLoading.current) return;
            isLoading.current = true;
            const controller = new AbortController();
            const signal = controller.signal;

            try {
                setWorkspaceLoading(true);

                const response = await fetch(
                    getServerUrl(
                        `${REMOTE_SERVER_ROUTES.GET_WORKSPACES}?user_email=${encodeURIComponent(
                            user?.email || ''
                        )}`
                    ),
                    { signal }
                );

                const data = await response.json();

                if (Array.isArray(data) && data.length > 0) {
                    console.log('Workspaces:', data);
                    const newWorkspaces = data.map((workspace: any) => ({
                        id: workspace.id,
                        name: workspace.name,
                        description: workspace.description || '',
                        updatedAt: workspace.updated_at || ''
                    }));

                    // Update only if new workspaces differ from current state
                    setWorkspaces(newWorkspaces);
                    // if (workspaces.length === 0) {
                    //     console.log(
                    //         'Adding workspaces:',
                    //         newWorkspaces,
                    //         newWorkspaces.find(
                    //             (workspace) => workspace.name === 'Temporary Workspace'
                    //         )
                    //     );
                    //     // addWorkspaceBatch(newWorkspaces);
                    //     // setCurrentWorkspace(
                    //     //     newWorkspaces.find(
                    //     //         (workspace) => workspace.name === 'Temporary Workspace'
                    //     //     )!
                    //     // );
                    // }
                    setWorkspaceLoading(false);
                } else {
                    console.log('No workspaces found.');
                    // Create a temporary workspace only if none exists
                    if (workspaces.length === 0) {
                        await handleCreateTempWorkspace();
                    }
                }
            } catch (error: any) {
                if (error.name !== 'AbortError') {
                    console.error('Error fetching workspaces:', error);
                }
            } finally {
                isLoading.current = false;
                setWorkspaceLoading(false);
            }

            return () => {
                controller.abort();
            };
        };

        if (user?.email) fetchWorkspaces();
    }, []);

    // Add workspace
    const handleAddWorkspace = async () => {
        if (!newWorkspaceName.trim()) {
            // toast.warning('Workspace name cannot be empty.');
            showToast({
                type: 'warning',
                message: 'Workspace name cannot be empty.'
            });
            return;
        }

        try {
            const response = await fetch(getServerUrl(REMOTE_SERVER_ROUTES.CREATE_WORKSPACE), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newWorkspaceName, user_email: user?.email })
            });

            const result = await response.json();

            if (!result || !result.id) {
                console.error('Invalid response from server:', result);
                return;
            }

            // Add workspace with client-provided name and placeholder description
            addWorkspace({
                id: result.id,
                name: newWorkspaceName, // Use the name entered by the user
                description: '', // Placeholder description if none provided
                updatedAt: result.updated_at
            });

            // Set the new workspace as the current workspace
            // setCurrentWorkspace(result);

            // Clear the input field
            setNewWorkspaceName('');
        } catch (error) {
            console.error('Error adding workspace:', error);
        }
    };

    // Rename workspace
    const handleRenameWorkspace = async (workspaceId: string) => {
        if (!renameWorkspaceName.trim()) {
            // toast.warning('Workspace name cannot be empty.');
            showToast({
                type: 'warning',
                message: 'Workspace name cannot be empty.'
            });
            return;
        }

        try {
            await fetch(getServerUrl(REMOTE_SERVER_ROUTES.UPDATE_WORKSPACE), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: workspaceId,
                    name: renameWorkspaceName,
                    user_email: user?.email
                })
            });
            updateWorkspace(workspaceId || '', renameWorkspaceName);
            // setRenameMode(false);
            setRenameWorkspaceName('');
            setRenamingWorkspace(null);
        } catch (error) {
            console.error('Error renaming workspace:', error);
        }
    };

    // Delete workspace
    const handleDeleteWorkspace = async (workspaceId: string) => {
        // if (workspaces.length <= 1) {
        //     toast.warning('You must have at least one workspace.');
        //     return;
        // }

        try {
            const res = await Promise.allSettled([
                fetch(getServerUrl(`${REMOTE_SERVER_ROUTES.DELETE_WORKSPACE}/${workspaceId}`), {
                    method: 'DELETE'
                }),
                fetch(getServerUrl(REMOTE_SERVER_ROUTES.DELETE_STATE), {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        workspace_id: workspaceId || '',
                        user_email: user?.email || ''
                    })
                })
            ]);
            console.log('Delete workspace response:', res);
            deleteWorkspace(workspaceId || '');
        } catch (error) {
            console.error('Error deleting workspace:', error);
        }
    };

    const toggleExpand = (id: string) => {
        setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    // const handleAddWorkspace = () => {
    //     if (!newWorkspaceName.trim()) {
    //         toast.warning('Workspace name cannot be empty.');
    //         return;
    //     }

    //     addWorkspace({ id: `${Date.now()}`, name: newWorkspaceName, description: '' });
    //     setNewWorkspaceName('');
    // };

    // const handleDeleteWorkspace = async (id: string) => {
    //     if (workspaces.length <= 1) {
    //         toast.warning('You must have at least one workspace.');
    //         return;
    //     }

    //     try {
    //         const res = await Promise.allSettled([
    //             fetch(getServerUrl(`${REMOTE_SERVER_ROUTES.DELETE_WORKSPACE}/${id}`), {
    //                 method: 'DELETE'
    //             }),
    //             fetch(getServerUrl(REMOTE_SERVER_ROUTES.DELETE_STATE), {
    //                 method: 'DELETE',
    //                 headers: { 'Content-Type': 'application/json' },
    //                 body: JSON.stringify({
    //                     workspace_id: id || '',
    //                     user_email: user?.email || ''
    //                 })
    //             })
    //         ]);
    //         console.log('Delete workspace response:', res);
    //         deleteWorkspace(id || '');
    //     } catch (error) {
    //         console.error('Error deleting workspace:', error);
    //     }
    // };

    // const handleRenameWorkspace = (id: string) => {
    //     if (!renameWorkspaceName.trim()) {
    //         toast.warning('Workspace name cannot be empty.');
    //         return;
    //     }

    //     updateWorkspace(id, renameWorkspaceName, undefined);
    //     setRenamingWorkspace(null);
    //     setRenameWorkspaceName('');
    // };

    const handleUpdateDescription = (id: string) => {
        updateWorkspace(id, undefined, newDescription);
        setEditingDescription(null);
        setNewDescription('');
    };

    const handleWorkspaceClick = (workspaceId: string) => {
        if (workspaceId) {
            setCurrentWorkspaceById(workspaceId);
        }
        navigate(`/${SHARED_ROUTES.CODING}/${CODING_ROUTES.HOME}`);
    };

    function sortWorkspacesByUpdatedAt(unsortedWorkspaces: typeof workspaces, order = 'desc') {
        return unsortedWorkspaces.sort((a, b) => {
            const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
            const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;

            return order === 'desc' ? dateB - dateA : dateA - dateB;
        });
    }

    if (loading) {
        return (
            <div className="h-page flex items-center justify-center px-6">
                <div className="text-lg font-medium">Loading workspaces...</div>
            </div>
        );
    }

    return (
        <div className="h-page">
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
                    {workspaces.length === 0 && (
                        <div className="text-gray-600 text-center">No workspaces found.</div>
                    )}
                    {sortWorkspacesByUpdatedAt(workspaces).map((workspace) => (
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
                                        className={`text-gray-800 flex-1 ${workspace.id === currentWorkspace?.id ? 'font-bold' : 'font-medium'}`}
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
                                        <FiEdit />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteWorkspace(workspace.id);
                                        }}
                                        className="text-red-500 hover:text-red-600">
                                        <FiTrash2 />
                                    </button>
                                </div>
                            </div>
                            {expanded[workspace.id] && (
                                <div className="ml-6 mt-2">
                                    <p className="text-sm text-gray-600">
                                        Workspace ID: {workspace.id}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                        Last Updated:{' '}
                                        {new Date(workspace.updatedAt ?? '').toLocaleDateString()}{' '}
                                        {new Date(workspace.updatedAt ?? '').toLocaleTimeString()}
                                    </p>
                                    {editingDescription === workspace.id ? (
                                        <textarea
                                            value={newDescription}
                                            onChange={(e) => setNewDescription(e.target.value)}
                                            onBlur={() => handleUpdateDescription(workspace.id)}
                                            className="w-full px-2 py-1 border rounded-md text-gray-700"
                                            autoFocus
                                        />
                                    ) : (
                                        <p
                                            className="text-sm text-gray-600 cursor-pointer hover:underline"
                                            onClick={() => {
                                                setEditingDescription(workspace.id);
                                                setNewDescription(workspace.description || '');
                                            }}>
                                            Description:{' '}
                                            {workspace.description || 'No description available'}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default WorkspaceSelectionPage;

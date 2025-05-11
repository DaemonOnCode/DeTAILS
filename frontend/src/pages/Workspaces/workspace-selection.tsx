import React, { useEffect, useRef, useState } from 'react';
import { useWorkspaceContext } from '../../context/workspace-context';
import {
    FiFolder,
    FiFolderPlus,
    FiChevronDown,
    FiChevronRight,
    FiEdit,
    FiTrash2,
    FiGitMerge
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { REMOTE_SERVER_ROUTES, ROUTES as SHARED_ROUTES } from '../../constants/Shared';
import { useAuth } from '../../context/auth-context';
import { ROUTES as CODING_ROUTES } from '../../constants/Coding/shared';
import { useToast } from '../../context/toast-context';
import { useApi } from '../../hooks/Shared/use-api';

const WorkspaceSelectionPage: React.FC = () => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const navigate = useNavigate();
    const [expanded, setExpanded] = useState<{ [key: string]: boolean }>({});
    const [renamingWorkspace, setRenamingWorkspace] = useState<string | null>(null);
    const [editingDescription, setEditingDescription] = useState<string | null>(null);
    const [newDescription, setNewDescription] = useState<string>('');
    const {
        workspaces,
        currentWorkspace,
        addWorkspace,
        setWorkspaces,
        updateWorkspace,
        deleteWorkspace,
        setCurrentWorkspaceById,
        setCurrentWorkspace,
        setWorkspaceLoading,
        workspaceLoading: loading
    } = useWorkspaceContext();

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    const { fetchData } = useApi();

    const [newWorkspaceName, setNewWorkspaceName] = useState<string>('');
    const [renameWorkspaceName, setRenameWorkspaceName] = useState<string>('');

    useEffect(() => {
        setCurrentWorkspace(null);
    }, [setCurrentWorkspace]);

    const isLoading = useRef(false);

    useEffect(() => {
        const fetchWorkspaces = async () => {
            if (isLoading.current) return;
            isLoading.current = true;
            setWorkspaceLoading(true);

            const maxRetries = 10;
            const baseDelayMs = 2000;

            const route = `${REMOTE_SERVER_ROUTES.GET_WORKSPACES}?user_email=${encodeURIComponent(
                user?.email || ''
            )}`;

            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    const { error, data } = await fetchData(route);
                    if (error) throw new Error(error.message.error_message);

                    if (Array.isArray(data) && data.length) {
                        setWorkspaces(
                            data.map((ws: any) => ({
                                id: ws.id,
                                name: ws.name,
                                description: ws.description || '',
                                updatedAt: ws.updated_at || ''
                            }))
                        );
                    } else {
                        console.log('No workspaces found.');
                    }
                    break;
                } catch (err: any) {
                    console.warn(`Attempt ${attempt} failed: ${err.message}`);
                    if (attempt === maxRetries) {
                        showToast({
                            type: 'error',
                            message: 'Unable to load workspaces after multiple attempts.'
                        });
                    } else {
                        const delay = baseDelayMs * 2 ** (attempt - 1);
                        await sleep(delay);
                    }
                }
            }

            setWorkspaceLoading(false);
            isLoading.current = false;
        };

        if (user?.email) fetchWorkspaces();
    }, [user?.email, fetchData]);

    const handleAddWorkspace = async () => {
        if (!newWorkspaceName.trim()) {
            showToast({
                type: 'warning',
                message: 'Workspace name cannot be empty.'
            });
            return;
        }
        try {
            const addResponse = await fetchData(REMOTE_SERVER_ROUTES.CREATE_WORKSPACE, {
                method: 'POST',
                body: JSON.stringify({ name: newWorkspaceName, user_email: user?.email })
            });
            if (addResponse.error) {
                console.error('Error adding workspace:', addResponse.error.message);
                return;
            }
            const result = addResponse.data;
            if (!result || !result.id) {
                console.error('Invalid response from server:', result);
                showToast({
                    type: 'error',
                    message: 'Invalid response from server.'
                });
                return;
            }
            addWorkspace({
                id: result.id,
                name: newWorkspaceName,
                description: '',
                updatedAt: result.updated_at
            });
            setNewWorkspaceName('');
        } catch (error) {
            console.error('Error adding workspace:', error);
            showToast({
                type: 'error',
                message: 'Error adding workspace.'
            });
        }
    };

    const handleRenameWorkspace = async (workspaceId: string) => {
        if (!renameWorkspaceName.trim()) {
            showToast({
                type: 'warning',
                message: 'Workspace name cannot be empty.'
            });
            return;
        }
        try {
            const renameResponse = await fetchData(REMOTE_SERVER_ROUTES.UPDATE_WORKSPACE, {
                method: 'PUT',
                body: JSON.stringify({
                    id: workspaceId,
                    name: renameWorkspaceName,
                    user_email: user?.email
                })
            });
            if (renameResponse.error) {
                console.error('Error renaming workspace:', renameResponse.error.message);
                showToast({
                    type: 'error',
                    message: 'Error renaming workspace.'
                });
                return;
            }
            updateWorkspace(workspaceId, renameWorkspaceName);
            setRenameWorkspaceName('');
            setRenamingWorkspace(null);
        } catch (error) {
            console.error('Error renaming workspace:', error);
            showToast({
                type: 'error',
                message: 'Error renaming workspace.'
            });
        }
    };

    const handleDeleteWorkspace = async (workspaceId: string) => {
        try {
            const deleteWorkspacePromise = fetchData(
                `${REMOTE_SERVER_ROUTES.DELETE_WORKSPACE}/${workspaceId}`,
                { method: 'DELETE' }
            );
            const deleteStatePromise = fetchData(REMOTE_SERVER_ROUTES.DELETE_STATE, {
                method: 'DELETE',
                body: JSON.stringify({
                    workspace_id: workspaceId,
                    user_email: user?.email || ''
                })
            });
            const results = await Promise.allSettled([deleteWorkspacePromise, deleteStatePromise]);
            console.log('Delete workspace response:', results);
            deleteWorkspace(workspaceId);
        } catch (error) {
            console.error('Error deleting workspace:', error);
            showToast({
                type: 'error',
                message: 'Error deleting workspace.'
            });
        }
    };

    const handleRestoreLastSaved = async (workspaceId: string) => {
        try {
            const restoreResponse = await fetchData(REMOTE_SERVER_ROUTES.RESTORE_LAST_SAVED, {
                method: 'POST',
                body: JSON.stringify({
                    workspace_id: workspaceId,
                    user_email: user?.email || ''
                })
            });
            if (restoreResponse.error) {
                console.error('Error restoring last saved:', restoreResponse.error.message);
                return;
            }
            showToast({
                type: 'success',
                message: 'Workspace restored successfully.'
            });
        } catch (error) {
            console.error('Error restoring last saved:', error);
            showToast({
                type: 'error',
                message: 'Error restoring workspace.'
            });
        }
    };

    const toggleExpand = (e: React.MouseEvent<HTMLSpanElement, MouseEvent>, id: string) => {
        e.stopPropagation();
        setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    const handleUpdateDescription = async (id: string) => {
        updateWorkspace(id, undefined, newDescription);
        setEditingDescription(null);
        setNewDescription('');

        await fetchData(REMOTE_SERVER_ROUTES.UPDATE_WORKSPACE, {
            method: 'PUT',
            body: JSON.stringify({
                id,
                description: newDescription
            })
        });
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
        <div className="max-h-page h-page flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-bold">Workspace Management</h1>
            </div>
            <div className="flex items-center gap-2 my-4">
                <input
                    type="text"
                    placeholder="New Workspace Name"
                    value={newWorkspaceName}
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                    className="px-3 py-2 border rounded-md text-gray-700 w-full max-w-lg min-w-36"
                />
                <button
                    onClick={handleAddWorkspace}
                    className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md flex items-center gap-2">
                    <FiFolderPlus />
                    Add
                </button>
            </div>
            <div className="shadow-[0_0_5px_rgba(0,0,0,0.25)] rounded-lg my-4 flex flex-col flex-1 overflow-hidden">
                <div className="p-4 border-b">
                    <h2 className="text-lg font-semibold">All Workspaces</h2>
                </div>
                <div className="p-4 overflow-y-auto flex-1">
                    {workspaces.length === 0 && (
                        <div className="text-gray-600 text-center">No workspaces found.</div>
                    )}
                    {sortWorkspacesByUpdatedAt(workspaces).map((workspace) => (
                        <div key={workspace.id} className="mb-2">
                            <div
                                className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-2 rounded"
                                onClick={() => handleWorkspaceClick(workspace.id)}>
                                <span onClick={(e) => toggleExpand(e, workspace.id)}>
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
                                        className={`text-gray-800 flex-1 ${
                                            workspace.id === currentWorkspace?.id
                                                ? 'font-bold'
                                                : 'font-medium'
                                        }`}>
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
                                        title="Edit Workspace"
                                        className="text-blue-500 hover:text-blue-600">
                                        <FiEdit />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleRestoreLastSaved(workspace.id);
                                        }}
                                        title="Restore Last Saved"
                                        className="text-[#6e5494] hover:text-[#4d3177]">
                                        <FiGitMerge />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteWorkspace(workspace.id);
                                        }}
                                        title="Delete Workspace"
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
                                            onChange={(e) => {
                                                // e.stopPropagation();
                                                setNewDescription(e.target.value);
                                            }}
                                            onBlur={(e) => {
                                                // e.stopPropagation();
                                                handleUpdateDescription(workspace.id);
                                            }}
                                            className="w-full px-2 py-1 border rounded-md text-gray-700 resize-none"
                                            autoFocus
                                        />
                                    ) : (
                                        <p
                                            className="text-sm text-gray-600 cursor-pointer hover:underline"
                                            onClick={(e) => {
                                                // e.stopPropagation();
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

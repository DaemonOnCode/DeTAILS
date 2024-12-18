import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/auth_context';
import { useWorkspaceContext } from '../../context/workspace_context';
import { REMOTE_SERVER_BASE_URL, REMOTE_SERVER_ROUTES } from '../../constants/Shared';

const Topbar: React.FC = () => {
    const { user, logout } = useAuth();
    const {
        workspaces,
        currentWorkspace,
        addWorkspace,
        addWorkspaceBatch,
        setCurrentWorkspace,
        updateWorkspace,
        deleteWorkspace
    } = useWorkspaceContext();

    const [newWorkspaceName, setNewWorkspaceName] = useState<string>('');
    const [renameMode, setRenameMode] = useState<boolean>(false);
    const [renameWorkspaceName, setRenameWorkspaceName] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(true);
    const [dropdownVisible, setDropdownVisible] = useState<boolean>(false);

    useEffect(() => {
        const fetchWorkspaces = async () => {
            const controller = new AbortController();
            const signal = controller.signal;

            try {
                setLoading(true);

                const response = await fetch(
                    `${REMOTE_SERVER_BASE_URL}/${REMOTE_SERVER_ROUTES.GET_WORKSPACES}?user_email=${encodeURIComponent(
                        user?.email || ''
                    )}`,
                    { signal }
                );

                const data = await response.json();

                if (Array.isArray(data) && data.length > 0) {
                    const newWorkspaces = data.map((workspace: any) => ({
                        id: workspace.id,
                        name: workspace.name,
                        description: workspace.description || ''
                    }));

                    // Update only if new workspaces differ from current state
                    if (workspaces.length === 0) {
                        addWorkspaceBatch(newWorkspaces);
                        setCurrentWorkspace(newWorkspaces[0].id); // Default to the first workspace
                    }
                } else {
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
                setLoading(false);
            }

            return () => {
                controller.abort();
            };
        };

        if (user?.email) fetchWorkspaces();
    }, [user?.email, addWorkspaceBatch, setCurrentWorkspace, workspaces.length]);

    const handleCreateTempWorkspace = async () => {
        try {
            if (workspaces.some((ws) => ws.name === 'Temporary Workspace')) {
                return; // Skip creating a temporary workspace if one exists
            }

            const response = await fetch(
                `${REMOTE_SERVER_BASE_URL}/${REMOTE_SERVER_ROUTES.CREATE_TEMP_WORKSPACE}?user_email=${encodeURIComponent(
                    user?.email || ''
                )}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                }
            );
            const tempWorkspace = await response.json();

            addWorkspaceBatch([{ id: tempWorkspace.id, name: 'Temporary Workspace' }]);
            setCurrentWorkspace(tempWorkspace.id);
        } catch (error) {
            console.error('Error creating temporary workspace:', error);
        }
    };

    // Add workspace
    const handleAddWorkspace = async () => {
        if (!newWorkspaceName.trim()) {
            alert('Workspace name cannot be empty.');
            return;
        }

        try {
            const response = await fetch(
                `${REMOTE_SERVER_BASE_URL}/${REMOTE_SERVER_ROUTES.CREATE_WORKSPACE}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: newWorkspaceName, user_email: user?.email })
                }
            );

            const result = await response.json();

            if (!result || !result.id) {
                console.error('Invalid response from server:', result);
                return;
            }

            // Add workspace with client-provided name and placeholder description
            addWorkspace({
                id: result.id,
                name: newWorkspaceName, // Use the name entered by the user
                description: '' // Placeholder description if none provided
            });

            // Set the new workspace as the current workspace
            setCurrentWorkspace(result.id);

            // Clear the input field
            setNewWorkspaceName('');
        } catch (error) {
            console.error('Error adding workspace:', error);
        }
    };

    // Rename workspace
    const handleRenameWorkspace = async () => {
        if (!renameWorkspaceName.trim()) {
            alert('Workspace name cannot be empty.');
            return;
        }

        try {
            await fetch(`${REMOTE_SERVER_BASE_URL}/${REMOTE_SERVER_ROUTES.UPDATE_WORKSPACE}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: currentWorkspace?.id,
                    name: renameWorkspaceName,
                    user_email: user?.email
                })
            });
            updateWorkspace(currentWorkspace?.id || '', renameWorkspaceName);
            setRenameMode(false);
            setRenameWorkspaceName('');
        } catch (error) {
            console.error('Error renaming workspace:', error);
        }
    };

    // Delete workspace
    const handleDeleteWorkspace = async () => {
        if (workspaces.length <= 1) {
            alert('You must have at least one workspace.');
            return;
        }

        try {
            await fetch(
                `${REMOTE_SERVER_BASE_URL}/${REMOTE_SERVER_ROUTES.DELETE_WORKSPACE}/${currentWorkspace?.id}`,
                { method: 'DELETE' }
            );
            deleteWorkspace(currentWorkspace?.id || '');
        } catch (error) {
            console.error('Error deleting workspace:', error);
        }
    };

    if (loading) {
        return (
            <div className="h-16 bg-gray-800 text-white flex items-center justify-center px-6 shadow-md">
                <div className="text-lg font-medium">Loading workspaces...</div>
            </div>
        );
    }

    return (
        <div className="h-16 bg-gray-800 text-white flex items-center justify-between px-6 shadow-md relative">
            {/* Workspace Selector */}
            <div className="flex items-center gap-4">
                <select
                    className="bg-gray-700 text-white px-4 py-2 rounded-md focus:outline-none"
                    value={currentWorkspace?.id || ''}
                    onChange={(e) => setCurrentWorkspace(e.target.value)}>
                    {workspaces.map((workspace) => (
                        <option key={workspace.id} value={workspace.id}>
                            {workspace.name}
                        </option>
                    ))}
                </select>

                {/* Add Workspace */}
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        placeholder="New Workspace Name"
                        value={newWorkspaceName}
                        onChange={(e) => setNewWorkspaceName(e.target.value)}
                        className="px-2 py-1 rounded-md text-gray-800"
                    />
                    <button
                        onClick={handleAddWorkspace}
                        className="bg-green-500 hover:bg-green-600 px-3 py-1 rounded-md text-sm font-medium">
                        + Add
                    </button>
                </div>

                {/* Rename Workspace */}
                {renameMode ? (
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            placeholder="Rename Workspace"
                            value={renameWorkspaceName}
                            onChange={(e) => setRenameWorkspaceName(e.target.value)}
                            onBlur={handleRenameWorkspace}
                            autoFocus
                            className="px-2 py-1 rounded-md text-gray-800"
                        />
                    </div>
                ) : (
                    <button
                        onClick={() => {
                            setRenameMode(true);
                            setRenameWorkspaceName(currentWorkspace?.name || '');
                        }}
                        className="bg-blue-500 hover:bg-blue-600 px-3 py-1 rounded-md text-sm font-medium">
                        Rename
                    </button>
                )}

                {/* Delete Workspace */}
                <button
                    onClick={handleDeleteWorkspace}
                    className="bg-red-500 hover:bg-red-600 px-3 py-1 rounded-md text-sm font-medium">
                    - Delete
                </button>
            </div>

            {/* Profile Section */}
            <div className="relative">
                {user?.picture && (
                    <>
                        <img
                            src={user.picture}
                            alt="User Profile"
                            className="w-10 h-10 rounded-full cursor-pointer border-2 border-gray-300"
                            onClick={() => setDropdownVisible((prev) => !prev)}
                        />
                        {dropdownVisible && (
                            <div className="absolute right-0 mt-2 w-40 bg-white rounded-md shadow-lg z-10">
                                <ul className="text-gray-800">
                                    <li className="px-4 py-2 border-b font-bold">{user.name}</li>
                                    <li
                                        className="hover:bg-gray-100 px-4 py-2 cursor-pointer"
                                        onClick={() => logout()}>
                                        Logout
                                    </li>
                                </ul>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default Topbar;

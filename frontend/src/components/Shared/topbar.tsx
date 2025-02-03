import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/auth-context';
import { useWorkspaceContext } from '../../context/workspace-context';
import { REMOTE_SERVER_ROUTES } from '../../constants/Shared';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import useServerUtils from '../../hooks/Shared/get-server-url';

const { ipcRenderer } = window.require('electron');

const Topbar: React.FC = () => {
    const { user, logout } = useAuth();
    const {
        workspaces,
        currentWorkspace,
        addWorkspace,
        addWorkspaceBatch,
        setCurrentWorkspace,
        updateWorkspace,
        deleteWorkspace,
        setCurrentWorkspaceById
    } = useWorkspaceContext();

    const [newWorkspaceName, setNewWorkspaceName] = useState<string>('');
    const [renameMode, setRenameMode] = useState<boolean>(false);
    const [renameWorkspaceName, setRenameWorkspaceName] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(true);
    const [dropdownVisible, setDropdownVisible] = useState<boolean>(false);

    const { loadWorkspaceData, getWorkspaceData, saveWorkspaceData } = useWorkspaceUtils();
    const { getServerUrl } = useServerUtils();

    const isLoading = useRef(false);

    useEffect(() => {
        const fetchWorkspaces = async () => {
            if (isLoading.current) return; // Prevent concurrent loads
            isLoading.current = true;
            const controller = new AbortController();
            const signal = controller.signal;

            try {
                setLoading(true);

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
                        description: workspace.description || ''
                    }));

                    // Update only if new workspaces differ from current state
                    if (workspaces.length === 0) {
                        console.log(
                            'Adding workspaces:',
                            newWorkspaces,
                            newWorkspaces.find(
                                (workspace) => workspace.name === 'Temporary Workspace'
                            )
                        );
                        addWorkspaceBatch(newWorkspaces);
                        setCurrentWorkspace(
                            newWorkspaces.find(
                                (workspace) => workspace.name === 'Temporary Workspace'
                            )!
                        );
                    }
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
            }

            return () => {
                controller.abort();
            };
        };

        if (user?.email) fetchWorkspaces();
    }, [user?.email, workspaces.length]);

    useEffect(() => {
        if (workspaces.length > 0 && currentWorkspace) {
            loadWorkspaceData().then(() => {
                isLoading.current = false;
                setLoading(false);
            });
        }
    }, [workspaces, currentWorkspace]);

    useEffect(() => {
        if (!currentWorkspace) return;
        // Listener for Save Workspace
        const handleSaveWorkspace = async () => {
            console.log('Saving workspace...');
            await saveWorkspaceData();
        };

        // Listener for Import Workspace
        const handleImportWorkspace = async (e: any, imported_file_path: string) => {
            try {
                console.log('Importing workspace from ZIP file:', imported_file_path);

                // Use Electron's file system module to read the file
                const fs = window.require('fs');

                // Read the file into memory
                const fileBuffer = fs.readFileSync(imported_file_path);

                // Use FormData to construct the payload
                const formData = new FormData();
                formData.append('user_email', user?.email || '');
                formData.append(
                    'file',
                    new Blob([fileBuffer], { type: 'application/zip' }),
                    imported_file_path.split('/').pop()
                );

                // Send the file to the backend
                const response = await fetch(getServerUrl(REMOTE_SERVER_ROUTES.IMPORT_WORKSPACE), {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('Failed to import workspace:', errorText);
                    alert('Failed to import workspace.');
                    return;
                }

                const result = await response.json();
                console.log('Workspace imported successfully:', result);
                addWorkspaceBatch([...workspaces, result.workspace]);
                setCurrentWorkspace(result.workspace);
            } catch (error) {
                console.error('Error importing workspace:', error);
                alert('An error occurred while importing the workspace.');
            }
        };

        // Listener for Export Workspace
        const handleExportWorkspace = async (e: any) => {
            console.log('Exporting workspace', currentWorkspace);

            try {
                const response = await fetch(getServerUrl(REMOTE_SERVER_ROUTES.EXPORT_WORKSPACE), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        workspace_id: currentWorkspace?.id ?? '',
                        user_email: user?.email ?? ''
                    })
                });

                if (!response.ok) {
                    console.error('Failed to export workspace:', await response.text());
                    alert('Failed to export workspace.');
                    return;
                }

                // Use ReadableStream to handle the response body
                // const contentDisposition = response.headers.get('Content-Disposition');
                // const fileName = contentDisposition
                //     ? contentDisposition.split('filename=')[1]
                //     : 'exported_workspace.zip';

                // const filePath = await ipcRenderer.invoke('save-file', {
                //     defaultPath: 'exported_workspace.zip'
                // });

                // if (!filePath) {
                //     console.log('User canceled the save dialog.');
                //     return;
                // }
                // Fallback for unsupported browsers
                console.warn('File System Access API not supported. Using fallback.');
                const reader = response.body?.getReader();
                const stream = new ReadableStream({
                    start(controller) {
                        const pump = async () => {
                            if (!reader) {
                                controller.close();
                                return;
                            }
                            const { done, value } = await reader.read();
                            if (done) {
                                controller.close();
                                return;
                            }
                            controller.enqueue(value);
                            pump();
                        };
                        pump();
                    }
                });

                const blob = await new Response(stream).blob();
                const url = window.URL.createObjectURL(blob);

                // Trigger file download
                const a = document.createElement('a');
                a.href = url;
                a.download = 'exported_workspace.zip';
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);

                console.log('Workspace exported and file saved successfully.');
            } catch (error) {
                console.error('Error exporting workspace:', error);
                alert('An error occurred while exporting the workspace.');
            }
        };

        // Register the IPC listeners
        ipcRenderer.on('menu-save-workspace', handleSaveWorkspace);
        ipcRenderer.on('menu-import-workspace', handleImportWorkspace);
        ipcRenderer.on('menu-export-workspace', handleExportWorkspace);

        // Cleanup function to remove listeners when the component unmounts
        return () => {
            ipcRenderer.removeListener('menu-save-workspace', handleSaveWorkspace);
            ipcRenderer.removeListener('menu-import-workspace', handleImportWorkspace);
            ipcRenderer.removeListener('menu-export-workspace', handleExportWorkspace);
        };
    }, [currentWorkspace]);

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
            setCurrentWorkspaceById(tempWorkspace.id);
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
                description: '' // Placeholder description if none provided
            });

            // Set the new workspace as the current workspace
            setCurrentWorkspace(result);

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
            await fetch(getServerUrl(REMOTE_SERVER_ROUTES.UPDATE_WORKSPACE), {
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
            const res = await Promise.allSettled([
                fetch(
                    getServerUrl(
                        `${REMOTE_SERVER_ROUTES.DELETE_WORKSPACE}/${currentWorkspace?.id}`
                    ),
                    { method: 'DELETE' }
                ),
                fetch(getServerUrl(REMOTE_SERVER_ROUTES.DELETE_STATE), {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        workspace_id: currentWorkspace?.id || '',
                        user_email: user?.email || ''
                    })
                })
            ]);
            console.log('Delete workspace response:', res);
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
        <div className="h-16 bg-gray-800 text-white flex items-center justify-between px-6 shadow-md  sticky top-0 z-10">
            {/* Workspace Selector */}
            <div className="flex items-center gap-4">
                <select
                    className="bg-gray-700 text-white px-4 py-2 rounded-md focus:outline-none"
                    value={currentWorkspace?.id || ''}
                    onChange={(e) => setCurrentWorkspaceById(e.target.value)}>
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
            <div
                className="relative"
                tabIndex={0} // Make the div focusable to enable onBlur
                onBlur={() => setDropdownVisible(false)}>
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

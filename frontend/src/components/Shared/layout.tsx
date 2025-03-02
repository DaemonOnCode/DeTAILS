import { FC, useEffect, useRef, useState } from 'react';
import Sidebar from './sidebar';
import { ILayout } from '../../types/Coding/shared';
import { useAuth } from '../../context/auth-context';
import { useWebSocket } from '../../context/websocket-context';
import { motion } from 'framer-motion';
import { useWorkspaceContext } from '../../context/workspace-context';
import { AppRoutes } from '../../router';
import { REMOTE_SERVER_ROUTES, ROUTES as SHARED_ROUTES } from '../../constants/Shared';
import { AppRouteArray } from '../../types/Shared';
import { recursivePathHider } from '../../utility/protect-routes';
import { toast } from 'react-toastify';
import useServerUtils from '../../hooks/Shared/get-server-url';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import BookmarkToastOverlay from './bookmark-tab-toast';

const { ipcRenderer } = window.require('electron');

export const Layout: FC<ILayout> = ({ children }) => {
    const { serviceStarting } = useWebSocket();
    const { remoteProcessing, user } = useAuth();
    const { workspaces, currentWorkspace, addWorkspaceBatch, addWorkspace, setWorkspaceLoading } =
        useWorkspaceContext();
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);

    useEffect(() => {
        console.log('Current Workspace:', currentWorkspace);
        if (!currentWorkspace?.id) {
            setIsSidebarCollapsed(true);
        } else {
            setIsSidebarCollapsed(false);
        }
    }, [currentWorkspace?.id]);

    const { saveWorkspaceData, loadWorkspaceData } = useWorkspaceUtils();
    const { getServerUrl } = useServerUtils();

    // useEffect(() => {
    //     console.log('Workspaces:', workspaces, 'Current Workspace:', currentWorkspace);
    // }, [currentWorkspace]);

    const isLoading = useRef(false);

    useEffect(() => {
        if (workspaces.length > 0 && currentWorkspace) {
            isLoading.current = true;
            loadWorkspaceData().then(() => {
                isLoading.current = false;
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
                const fs = window.require('fs');
                const fileBuffer = fs.readFileSync(imported_file_path);
                const formData = new FormData();
                formData.append('user_email', user?.email || '');
                formData.append(
                    'file',
                    new Blob([fileBuffer], { type: 'application/zip' }),
                    imported_file_path.split('/').pop()
                );
                const response = await fetch(getServerUrl(REMOTE_SERVER_ROUTES.IMPORT_WORKSPACE), {
                    method: 'POST',
                    body: formData
                });
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('Failed to import workspace:', errorText);
                    toast.warning('Failed to import workspace.');
                    return;
                }
                const result = await response.json();
                console.log('Workspace imported successfully:', result);
                addWorkspaceBatch([...workspaces, result.workspace]);
            } catch (error) {
                console.error('Error importing workspace:', error);
                toast.warning('An error occurred while importing the workspace.');
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
                    toast.warning('Failed to export workspace.');
                    return;
                }
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
                toast.warning('An error occurred while exporting the workspace.');
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

    let filteredRoutes: AppRouteArray = AppRoutes;
    const SHARED_ROUTES_TO_EXCLUDE = [
        SHARED_ROUTES.CODING,
        SHARED_ROUTES.CLEANING,
        SHARED_ROUTES.DATA_COLLECTION,
        SHARED_ROUTES.DATA_MODELING
    ];
    if (!currentWorkspace) {
        filteredRoutes = recursivePathHider(filteredRoutes, SHARED_ROUTES_TO_EXCLUDE);
    }

    // console.log('Layout remoteProcessing:', remoteProcessing, 'serviceStarting:', serviceStarting);

    if (!remoteProcessing && serviceStarting) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen">
                <div className="flex space-x-4 mb-6">
                    <motion.div
                        className="h-5 w-5 bg-black rounded-full"
                        animate={{ y: [0, -20, 0] }}
                        transition={{
                            duration: 0.6,
                            repeat: Infinity,
                            repeatType: 'loop',
                            delay: 0
                        }}
                    />
                    <motion.div
                        className="h-5 w-5 bg-black rounded-full"
                        animate={{ y: [0, -20, 0] }}
                        transition={{
                            duration: 0.6,
                            repeat: Infinity,
                            repeatType: 'loop',
                            delay: 0.2
                        }}
                    />
                    <motion.div
                        className="h-5 w-5 bg-black rounded-full"
                        animate={{ y: [0, -20, 0] }}
                        transition={{
                            duration: 0.6,
                            repeat: Infinity,
                            repeatType: 'loop',
                            delay: 0.4
                        }}
                    />
                </div>
                <h1 className="text-3xl font-bold mb-4">Starting Services...</h1>
                <p className="text-lg text-gray-600">
                    Please wait while we initialize the backend services. This may take a few
                    moments.
                </p>
            </div>
        );
    } else {
        return (
            <div>
                {/* Optionally include the Topbar */}
                {/* <Topbar /> */}

                <BookmarkToastOverlay />
                <div className="flex flex-1">
                    <div
                        className={`transition-all duration-300 ${isSidebarCollapsed ? 'w-12 lg:w-16' : 'w-48 lg:w-64'}`}>
                        <Sidebar
                            routes={filteredRoutes}
                            isCollapsed={isSidebarCollapsed}
                            onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                        />
                    </div>

                    <div className="flex-1 flex flex-col overflow-hidden transition-all duration-300">
                        <div className="responsive-page-padding h-screen overflow-auto responsive-text">
                            {children}
                        </div>
                    </div>
                </div>
            </div>
        );
    }
};

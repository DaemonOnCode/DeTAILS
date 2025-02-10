import { FC, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AppRoutes } from '../../router';
import { RouteObject } from 'react-router-dom';
import { REMOTE_SERVER_ROUTES, ROUTES as SHARED_ROUTES } from '../../constants/Shared';
import { useAuth } from '../../context/auth-context';
import { toast } from 'react-toastify';
import useServerUtils from '../../hooks/Shared/get-server-url';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import { useWorkspaceContext } from '../../context/workspace-context';

const { ipcRenderer } = window.require('electron');

// Format route names for display
const formatRouteName = (path: string) => {
    return path
        .replace(/#/g, '')
        .replace(/_/g, ' ')
        .replace(/-/g, ' ')
        .toLowerCase()
        .replace(' v2', '')
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

// Define keywords to filter out paths
const IGNORED_KEYWORDS = [
    '*',
    '/',
    'loader',
    SHARED_ROUTES.CLEANING,
    SHARED_ROUTES.DATA_COLLECTION,
    SHARED_ROUTES.DATA_MODELING,
    SHARED_ROUTES.SETTINGS,
    'basis',
    'flashcards',
    'word-cloud',
    'coding-validation',
    'transcript/:id/:state'
];

interface SidebarProps {
    isCollapsed: boolean;
    onToggleCollapse: () => void;
}

const Sidebar: FC<SidebarProps> = ({ isCollapsed, onToggleCollapse }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const [userDropdownVisible, setUserDropdownVisible] = useState<boolean>(false);

    const [openDropdowns, setOpenDropdowns] = useState<Set<string>>(new Set());

    const { workspaces, currentWorkspace, addWorkspaceBatch } = useWorkspaceContext();
    const { saveWorkspaceData, loadWorkspaceData } = useWorkspaceUtils();
    const { getServerUrl } = useServerUtils();

    useEffect(() => {
        console.log('Workspaces:', workspaces, 'Current Workspace:', currentWorkspace);
    }, [currentWorkspace]);

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
                    toast.warning('Failed to import workspace.');
                    return;
                }

                const result = await response.json();
                console.log('Workspace imported successfully:', result);
                addWorkspaceBatch([...workspaces, result.workspace]);
                // setCurrentWorkspace(result.workspace);
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

    // Toggle dropdown visibility
    const toggleDropdown = (path: string) => {
        setOpenDropdowns((prev) => {
            const newSet = new Set(prev);
            newSet.has(path) ? newSet.delete(path) : newSet.add(path);
            return newSet;
        });
    };

    // Check if a route should be ignored
    const shouldIgnoreRoute = (path: string | undefined) => {
        if (!path) return false;
        return IGNORED_KEYWORDS.some((keyword) => path.toLowerCase() === keyword);
    };

    // Highlight current route
    const isCurrentPath = (fullPath: string) => location.pathname === fullPath;

    // Find the default route (index: true) within children
    const findDefaultRoute = (children: RouteObject[]): string | null => {
        const indexRoute = children.find((child) => child.index);
        return indexRoute ? indexRoute.path || '' : null;
    };

    // Render the routes recursively
    const renderRoutes = (routes: RouteObject[], parentPath = ''): JSX.Element[] => {
        return routes
            .filter((route) => !shouldIgnoreRoute(route.path))
            .map((route, idx) => {
                if (route.path === undefined && route.children) {
                    return <div key={idx}>{renderRoutes(route.children, parentPath)}</div>;
                }

                const fullPath = `${parentPath}/${route.path || ''}`.replace(/\/+/g, '/');

                if (route.children) {
                    const defaultChildPath = findDefaultRoute(route.children);
                    const defaultPath = `${fullPath}/${defaultChildPath}`.replace(/\/+/g, '/');

                    return (
                        <li key={idx} className="mb-2">
                            <div className="flex justify-between items-center">
                                <button
                                    className={`flex-grow text-left p-2 rounded-lg transition font-medium ${
                                        isCurrentPath(fullPath)
                                            ? 'bg-blue-500 text-white'
                                            : 'hover:bg-gray-700'
                                    }`}
                                    onClick={() => {
                                        if (defaultChildPath) {
                                            navigate(defaultPath);
                                        }
                                        toggleDropdown(fullPath);
                                    }}>
                                    {formatRouteName(route.path || '')}
                                </button>
                                <button
                                    className="p-2 text-gray-400 hover:text-white transition-transform transform duration-300"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleDropdown(fullPath);
                                    }}>
                                    <span
                                        className={`inline-block transform transition-transform duration-300 ease-in-out ${
                                            openDropdowns.has(fullPath) ? '-rotate-180' : 'rotate-0'
                                        }`}>
                                        ▼
                                    </span>
                                </button>
                            </div>
                            <ul
                                className={`ml-4 border-l border-gray-700 pl-2 mt-2 transition-all duration-300 overflow-hidden ${
                                    openDropdowns.has(fullPath) ? '' : 'max-h-0'
                                }`}>
                                {renderRoutes(route.children, fullPath)}
                            </ul>
                        </li>
                    );
                }

                return (
                    <li key={idx} className="mb-2">
                        <Link
                            to={fullPath}
                            className={`block p-2 rounded-lg transition font-medium ${
                                isCurrentPath(fullPath)
                                    ? 'bg-blue-500 text-white'
                                    : 'hover:bg-gray-700'
                            }`}>
                            {formatRouteName(route.path || 'Home')}
                        </Link>
                    </li>
                );
            });
    };

    return (
        <div
            className={`fixed h-screen bg-gray-800 text-white shadow-lg transition-all duration-300 flex ${
                isCollapsed ? 'min-w-16' : 'max-w-64'
            }`}>
            <div
                className={`flex flex-col justify-between ${isCollapsed ? 'max-w-0 hidden' : 'max-w-full'}`}>
                {/* Left Section: Collapsible Navigation */}
                <div className={`flex-1 overflow-hidden`}>
                    <nav className="h-full overflow-y-auto">
                        <ul className="p-4">{renderRoutes(AppRoutes)}</ul>
                    </nav>
                </div>

                <div className="p-4 border-t-2 border-gray-500">
                    <div
                        className="relative cursor-pointer"
                        tabIndex={0}
                        onClick={() => setUserDropdownVisible((prev) => !prev)}
                        onBlur={() => setUserDropdownVisible(false)}>
                        {user?.picture && (
                            <>
                                <div className="flex justify-center items-center">
                                    <img
                                        src={user.picture}
                                        alt="User Profile"
                                        className="w-10 h-10 rounded-full border-2 border-gray-300"
                                    />
                                    <span className="m-2 break-words max-w-28">{user.name}</span>
                                </div>
                                {userDropdownVisible && (
                                    <div className="absolute right-0 bottom-full mb-2 w-40 bg-white rounded-md shadow-lg z-10">
                                        <ul className="text-gray-800">
                                            <li
                                                className="px-4 py-2 border-b"
                                                onClick={() => navigate(SHARED_ROUTES.SETTINGS)}>
                                                Settings
                                            </li>
                                            <li
                                                className="hover:bg-gray-100 rounded-b-md px-4 py-2 cursor-pointer"
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
            </div>

            {/* Right Section: Collapse Button (Always Visible) */}
            <div className="w-16 flex justify-center items-center bg-gray-900">
                <button
                    onClick={() => onToggleCollapse()}
                    className="text-white p-3 rounded-full bg-blue-500 hover:bg-blue-700 transition-transform">
                    <p
                        className={`text-2xl transform transition-transform ${isCollapsed ? 'rotate-180' : 'rotate-0'}`}>
                        ◀
                    </p>
                </button>
            </div>
        </div>
    );
};

export default Sidebar;

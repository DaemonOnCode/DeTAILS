import { FC, useEffect, useRef, useState } from 'react';
import Sidebar from './sidebar';
import { ILayout } from '../../types/Coding/shared';
import { useAuth } from '../../context/auth-context';
import { useWebSocket } from '../../context/websocket-context';
import { motion } from 'framer-motion';
import { useWorkspaceContext } from '../../context/workspace-context';
import { AppRoutes } from '../../router';
import { ROUTES as SHARED_ROUTES } from '../../constants/Shared';
import { AppRouteArray } from '../../types/Shared';
import { recursivePathHider } from '../../utility/protect-routes';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import BookmarkToastOverlay from './bookmark-tab-toast';

const { ipcRenderer } = window.require('electron');

export const Layout: FC<ILayout> = ({ children }) => {
    const { serviceStarting } = useWebSocket();
    const { remoteProcessing } = useAuth();
    const { workspaces, currentWorkspace } = useWorkspaceContext();
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

        ipcRenderer.on('menu-save-workspace', handleSaveWorkspace);

        return () => {
            ipcRenderer.removeListener('menu-save-workspace', handleSaveWorkspace);
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
                <h1 className="text-3xl font-bold mb-4">Starting Services</h1>
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

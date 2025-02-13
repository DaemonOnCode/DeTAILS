import React, { createContext, useContext, useState, FC, useMemo, useCallback } from 'react';
import { IWorkspaceContext, Workspace } from '../types/Shared';

const WorkspaceContext = createContext<IWorkspaceContext | undefined>(undefined);

export const WorkspaceProvider: FC<{ children: React.ReactNode }> = ({ children }) => {
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [currentWorkspace, setCurrentWorkspaceState] = useState<Workspace | null>(null);
    const [workspaceLoading, setWorkspaceLoading] = useState(false);

    const updateWorkspace = useCallback((id: string, name?: string, description?: string) => {
        setWorkspaces((prev) =>
            prev.map((ws) =>
                ws.id === id
                    ? { ...ws, ...(name && { name }), ...(description && { description }) }
                    : ws
            )
        );
    }, []);

    const deleteWorkspace = useCallback((id: string) => {
        setCurrentWorkspaceState(null);
        setWorkspaces((prev) => {
            let newWorkspaces = prev.filter((ws) => ws.id !== id);
            setCurrentWorkspaceState(null);
            return newWorkspaces.length > 0 ? newWorkspaces : [];
        });
    }, []);

    const addWorkspaceBatch = useCallback((newWorkspaces: Workspace[]) => {
        setWorkspaces((prevWorkspaces) => {
            const existingIds = new Set(prevWorkspaces.map((ws) => ws.id));
            const filteredNewWorkspaces = newWorkspaces.filter((ws) => !existingIds.has(ws.id));
            return [...prevWorkspaces, ...filteredNewWorkspaces];
        });
    }, []);

    const addWorkspace = useCallback(
        (workspace: Workspace) => {
            setWorkspaces((prevWorkspaces) => {
                // Prevent duplicates
                const exists = prevWorkspaces.some((ws) => ws.id === workspace.id);
                return exists ? prevWorkspaces : [...prevWorkspaces, workspace];
            });
        },
        [currentWorkspace]
    );

    // Set current workspace
    const setCurrentWorkspace = useCallback(
        (workspace: Workspace) => {
            setCurrentWorkspaceState(workspace);
        },
        [workspaces]
    );

    const setCurrentWorkspaceById = useCallback(
        (workspaceId: string) => {
            setCurrentWorkspaceState(
                (prev) => workspaces.find((ws) => ws.id === workspaceId) || prev
            );
        },
        [workspaces]
    );

    const resetWorkspaces = useCallback(() => {
        setWorkspaces([]);
        setCurrentWorkspaceState(null);
    }, []);

    const value = useMemo(
        () => ({
            workspaces,
            setWorkspaces,
            currentWorkspace,
            addWorkspace,
            addWorkspaceBatch,
            updateWorkspace,
            deleteWorkspace,
            setCurrentWorkspace,
            resetWorkspaces,
            setCurrentWorkspaceById,
            workspaceLoading,
            setWorkspaceLoading
        }),
        [workspaces, currentWorkspace, workspaceLoading]
    );

    return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
};

export const useWorkspaceContext = (): IWorkspaceContext => {
    const context = useContext(WorkspaceContext);
    if (!context) {
        throw new Error('useWorkspaceContext must be used within a WorkspaceProvider');
    }
    return context;
};

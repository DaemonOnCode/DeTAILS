import React, { createContext, useContext, useState, FC, useMemo, useCallback } from 'react';

interface Workspace {
    id: string;
    name: string;
    description?: string;
}

interface IWorkspaceContext {
    workspaces: Workspace[];
    currentWorkspace: Workspace | null;
    addWorkspace: (workspace: Workspace) => void;
    updateWorkspace: (id: string, name: string) => void;
    deleteWorkspace: (id: string) => void;
    setCurrentWorkspace: (workspaceId: string) => void;
    resetWorkspaces: () => void;
    addWorkspaceBatch: (newWorkspaces: Workspace[]) => void;
}

const WorkspaceContext = createContext<IWorkspaceContext | undefined>(undefined);

export const WorkspaceProvider: FC<{ children: React.ReactNode }> = ({ children }) => {
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [currentWorkspace, setCurrentWorkspaceState] = useState<Workspace | null>(null);

    // Add workspace

    // Update workspace
    const updateWorkspace = useCallback((id: string, name: string) => {
        setWorkspaces((prev) => prev.map((ws) => (ws.id === id ? { ...ws, name } : ws)));
    }, []);

    // Delete workspace
    const deleteWorkspace = useCallback((id: string) => {
        setWorkspaces((prev) => prev.filter((ws) => ws.id !== id));
        setCurrentWorkspaceState((prev) => (prev?.id === id ? null : prev));
    }, []);

    const addWorkspaceBatch = useCallback((newWorkspaces: Workspace[]) => {
        setWorkspaces((prevWorkspaces) => {
            const existingIds = new Set(prevWorkspaces.map((ws) => ws.id));
            const filteredNewWorkspaces = newWorkspaces.filter((ws) => !existingIds.has(ws.id));
            return [...prevWorkspaces, ...filteredNewWorkspaces];
        });
    }, []);

    // const setCurrentWorkspace = useCallback((workspaceId: string) => {
    //   setCurrentWorkspaceState((prev) =>
    //     workspaces.find((ws) => ws.id === workspaceId) || prev
    //   );
    // }, [workspaces]);

    const addWorkspace = useCallback(
        (workspace: Workspace) => {
            setWorkspaces((prevWorkspaces) => {
                // Prevent duplicates
                const exists = prevWorkspaces.some((ws) => ws.id === workspace.id);
                return exists ? prevWorkspaces : [...prevWorkspaces, workspace];
            });
            if (!currentWorkspace) {
                setCurrentWorkspaceState(workspace);
            }
        },
        [currentWorkspace]
    );

    // Set current workspace
    const setCurrentWorkspace = useCallback(
        (workspaceId: string) => {
            setCurrentWorkspaceState(
                (prev) => workspaces.find((ws) => ws.id === workspaceId) || prev
            );
        },
        [workspaces]
    );

    // Reset all workspaces
    const resetWorkspaces = useCallback(() => {
        setWorkspaces([]);
        setCurrentWorkspaceState(null);
    }, []);

    const value = useMemo(
        () => ({
            workspaces,
            currentWorkspace,
            addWorkspace,
            addWorkspaceBatch, // Add the batched update function
            updateWorkspace,
            deleteWorkspace,
            setCurrentWorkspace,
            resetWorkspaces
        }),
        [
            workspaces,
            currentWorkspace,
            addWorkspace,
            addWorkspaceBatch,
            updateWorkspace,
            deleteWorkspace,
            setCurrentWorkspace,
            resetWorkspaces
        ]
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

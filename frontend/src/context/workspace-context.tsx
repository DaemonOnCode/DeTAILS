import React, {
    createContext,
    useContext,
    useState,
    FC,
    useMemo,
    useCallback,
    useEffect
} from 'react';

interface Workspace {
    id: string;
    name: string;
    description?: string;
}

export interface IWorkspaceContext {
    workspaces: Workspace[];
    currentWorkspace: Workspace | null;
    addWorkspace: (workspace: Workspace) => void;
    updateWorkspace: (id: string, name?: string, description?: string) => void;
    deleteWorkspace: (id: string) => void;
    setCurrentWorkspace: (workspace: Workspace) => void;
    resetWorkspaces: () => void;
    addWorkspaceBatch: (newWorkspaces: Workspace[]) => void;
    setCurrentWorkspaceById: (workspaceId: string) => void;
}

const WorkspaceContext = createContext<IWorkspaceContext | undefined>(undefined);

export const WorkspaceProvider: FC<{ children: React.ReactNode }> = ({ children }) => {
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [currentWorkspace, setCurrentWorkspaceState] = useState<Workspace | null>(null);

    // Add workspace

    // Update workspace
    const updateWorkspace = useCallback((id: string, name?: string, description?: string) => {
        setWorkspaces((prev) =>
            prev.map((ws) =>
                ws.id === id
                    ? { ...ws, ...(name && { name }), ...(description && { description }) }
                    : ws
            )
        );
    }, []);

    // Delete workspace
    const deleteWorkspace = useCallback((id: string) => {
        setCurrentWorkspaceState(null);
        setWorkspaces((prev) => {
            let newWorkspaces = prev.filter((ws) => ws.id !== id);
            setCurrentWorkspaceState(newWorkspaces[0] ?? null);
            return newWorkspaces.length > 0 ? newWorkspaces : [];
        });
    }, []);

    const addWorkspaceBatch = useCallback((newWorkspaces: Workspace[]) => {
        setWorkspaces((prevWorkspaces) => {
            const existingIds = new Set(prevWorkspaces.map((ws) => ws.id));
            const filteredNewWorkspaces = newWorkspaces.filter((ws) => !existingIds.has(ws.id));
            return [...prevWorkspaces, ...filteredNewWorkspaces];
        });
        if (!currentWorkspace) {
            setCurrentWorkspaceState(
                newWorkspaces.find((ws) => ws.name === 'Temporary Workspace') ?? null
            );
        }
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
    // Reset all workspaces
    const resetWorkspaces = useCallback(() => {
        setWorkspaces([]);
        setCurrentWorkspaceState(null);
    }, []);

    useEffect(() => {
        console.log('Workspaces:', workspaces, 'Current Workspace:', currentWorkspace);
    }, [currentWorkspace]);

    const value = useMemo(
        () => ({
            workspaces,
            currentWorkspace,
            addWorkspace,
            addWorkspaceBatch, // Add the batched update function
            updateWorkspace,
            deleteWorkspace,
            setCurrentWorkspace,
            resetWorkspaces,
            setCurrentWorkspaceById
        }),
        [workspaces, currentWorkspace]
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

import React, { createContext, useContext, useRef, FC, ReactNode, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const { ipcRenderer } = window.require('electron');

interface IUndoContext {
    logOperation: (undoFunction: () => void) => void;
    undo: () => void;
}

const UndoContext = createContext<IUndoContext>({
    logOperation: () => {},
    undo: () => {}
});

const STACK_SIZE = 50;

export const UndoProvider: FC<{ children: ReactNode }> = ({ children }) => {
    const undoStack = useRef<(() => void)[]>([]);
    const location = useLocation();

    const logOperation = (undoFunction: () => void) => {
        undoStack.current.push(undoFunction);
        if (undoStack.current.length > STACK_SIZE) {
            undoStack.current.shift();
        }
    };

    const undo = () => {
        const undoFunction = undoStack.current.pop();
        if (undoFunction) {
            undoFunction();
        }
    };

    useEffect(() => {
        undoStack.current = [];
    }, [location.pathname]);

    useEffect(() => {
        const handleUndo = () => {
            console.log('Undoing operation');
            undo();
        };

        ipcRenderer.on('undo', handleUndo);

        return () => {
            ipcRenderer.removeListener('undo', handleUndo);
        };
    }, [undo]);

    const value = { logOperation, undo };

    return <UndoContext.Provider value={value}>{children}</UndoContext.Provider>;
};

export const useUndoContext = () => useContext(UndoContext);

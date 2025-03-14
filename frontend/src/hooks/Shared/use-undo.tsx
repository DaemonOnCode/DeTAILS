import { useCallback, useRef } from 'react';
import { useUndoContext } from '../../context/undo-context';

type StateSetter<T> = (value: T) => void;

export function useUndo() {
    const stateRegistry = useRef<Map<string, { state: any; setter: StateSetter<any> }>>(new Map());
    const undoStack = useRef<Array<() => void>>([]);

    const { logOperation } = useUndoContext();
    const registerState = useCallback((key: string, state: any, setter: StateSetter<any>) => {
        stateRegistry.current.set(key, { state, setter });
    }, []);

    const batchUpdate = useCallback((operation: () => void, operationType: string = 'batch') => {
        const beforeStates: { [key: string]: any } = {};
        stateRegistry.current.forEach((entry, key) => {
            beforeStates[key] = entry.state;
        });

        operation();

        const undoFunction = () => {
            Object.keys(beforeStates).forEach((key) => {
                const setter = stateRegistry.current.get(key)?.setter;
                if (setter) {
                    setter(beforeStates[key]);
                }
            });
        };

        undoStack.current.push(undoFunction);
        console.log(`Logged batch operation: ${operationType}`);
    }, []);

    const undo = useCallback(() => {
        const undoFunction = undoStack.current.pop();
        if (undoFunction) {
            undoFunction();
            console.log('Performed undo');
        } else {
            console.log('Nothing to undo');
        }
    }, []);

    function performWithUndo(
        states: any[],
        setters: ((value: any) => void)[],
        operation: () => void
    ) {
        const beforeStates = states.map((state) => JSON.parse(JSON.stringify(state)));

        const undoFn = () => {
            states.forEach((_, index) => {
                setters[index](beforeStates[index]);
            });
        };

        logOperation(undoFn);

        operation();
    }

    function performWithUndoForReducer(
        currentState: any,
        dispatch: (action: any) => void,
        action: any
    ) {
        const previousState = currentState;
        const undoFn = () => {
            dispatch({ type: 'RESTORE_STATE', payload: previousState });
        };

        logOperation(undoFn);

        dispatch(action);
    }

    return { registerState, batchUpdate, undo, performWithUndo, performWithUndoForReducer };
}

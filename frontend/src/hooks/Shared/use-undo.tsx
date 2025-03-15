import { useCallback, useRef } from 'react';
import { useUndoContext } from '../../context/undo-context';

type StateSetter<T> = (value: T) => void;

export function useUndo() {
    const stateRegistry = useRef<Map<string, { state: any; setter: StateSetter<any> }>>(new Map());
    const { logOperation } = useUndoContext();

    const isBatching = useRef(false);
    const batchUndoFunctions = useRef<(() => void)[]>([]);

    const logOperationLocal = useCallback(
        (undoFn: () => void) => {
            if (isBatching.current) {
                batchUndoFunctions.current.push(undoFn);
            } else {
                logOperation(undoFn);
            }
        },
        [logOperation]
    );

    // Start a batch
    const beginBatch = useCallback(() => {
        isBatching.current = true;
        batchUndoFunctions.current = [];
    }, []);

    const endBatch = useCallback(() => {
        isBatching.current = false;
        const batchUndos = [...batchUndoFunctions.current].reverse();
        const batchUndoFn = () => {
            batchUndos.forEach((undoFn) => undoFn());
        };
        logOperation(batchUndoFn);
        batchUndoFunctions.current = [];
    }, [logOperation]);

    const batch = useCallback(
        (callback: () => void) => {
            beginBatch();
            try {
                callback();
            } finally {
                endBatch();
            }
        },
        [beginBatch, endBatch]
    );

    const registerState = useCallback((key: string, state: any, setter: StateSetter<any>) => {
        stateRegistry.current.set(key, { state, setter });
    }, []);

    const batchUpdate = useCallback(
        (operation: () => void, operationType: string = 'batch') => {
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

            logOperationLocal(undoFunction);
            console.log(`Logged batch operation: ${operationType}`);
        },
        [logOperationLocal]
    );

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

        logOperationLocal(undoFn);

        operation();
    }

    function performWithUndoForReducer(
        currentState: any,
        dispatch: (action: any) => void,
        action: any
    ) {
        console.log('Performing with undo for reducer:', action, currentState);
        const previousState = currentState;
        const undoFn = () => {
            dispatch({ type: 'RESTORE_STATE', payload: previousState });
        };

        logOperationLocal(undoFn);

        dispatch(action);
    }

    return {
        registerState,
        batchUpdate,
        performWithUndo,
        performWithUndoForReducer,
        batch
    };
}

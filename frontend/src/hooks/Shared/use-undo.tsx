import { useCallback, useEffect, useRef } from 'react';
import { useUndoContext } from '../../context/undo-context';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

type StateSetter<T> = (value: T) => void;

interface UndoToastProps {
    undo: () => void;
    closeToast: () => void;
}

const UndoToast: React.FC<UndoToastProps> = ({ undo, closeToast }) => {
    return (
        <div className="max-w-sm w-full pointer-events-auto">
            <div className="flex items-center">
                <div className="flex-1">
                    <p className="font-medium text-gray-900">Action performed.</p>
                </div>
                <div>
                    <button
                        onClick={() => {
                            console.log('Undo button clicked');
                            undo();
                            closeToast();
                        }}
                        className="ml-4 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                        Undo
                    </button>
                </div>
            </div>
        </div>
    );
};

export function useUndo() {
    const stateRegistry = useRef<Map<string, { state: any; setter: StateSetter<any> }>>(new Map());
    const { logOperation, undo } = useUndoContext();

    const isBatching = useRef(false);
    const batchUndoFunctions = useRef<(() => void)[]>([]);

    const logOperationLocal = useCallback(
        (undoFn: () => void, showToast: boolean = true) => {
            if (isBatching.current) {
                console.log('Batching operation, adding undo function to batch');
                batchUndoFunctions.current.push(undoFn);
            } else {
                console.log('Logging single operation and showing toast');
                logOperation(undoFn);
                if (showToast) {
                    toast.info(<UndoToast undo={undo} closeToast={() => toast.dismiss()} />, {
                        autoClose: 5000,
                        closeOnClick: false,
                        draggable: false
                    });
                }
            }
        },
        [logOperation, undo]
    );

    const beginBatch = useCallback(() => {
        console.log('Beginning batch');
        isBatching.current = true;
        batchUndoFunctions.current = [];
    }, []);

    const endBatch = useCallback(
        (showToast: boolean = true) => {
            console.log('Ending batch, logging batch operation');
            isBatching.current = false;
            const batchUndos = [...batchUndoFunctions.current].reverse();
            const batchUndoFn = () => {
                batchUndos.forEach((undoFn) => undoFn());
            };
            logOperation(batchUndoFn);
            if (showToast)
                toast.info(<UndoToast undo={undo} closeToast={() => toast.dismiss()} />, {
                    autoClose: 5000,
                    closeOnClick: false,
                    draggable: false
                });
            batchUndoFunctions.current = [];
        },
        [logOperation, undo]
    );

    const batch = useCallback(
        (callback: () => void, showToast: boolean = true) => {
            console.log('Starting batch operation');
            beginBatch();
            try {
                callback();
                console.log('Finished batch operation');
            } finally {
                endBatch(showToast);
            }
        },
        [beginBatch, endBatch]
    );

    const registerState = useCallback((key: string, state: any, setter: StateSetter<any>) => {
        console.log(`Registering state with key: ${key}`);
        stateRegistry.current.set(key, { state, setter });
    }, []);

    const batchUpdate = useCallback(
        (operation: () => void, operationType: string = 'batch', showToast: boolean = true) => {
            const beforeStates: { [key: string]: any } = {};
            stateRegistry.current.forEach((entry, key) => {
                beforeStates[key] = entry.state;
            });

            console.log('Before batch update: states registered');
            operation();
            console.log('Batch update operation performed');

            const undoFunction = () => {
                Object.keys(beforeStates).forEach((key) => {
                    const setter = stateRegistry.current.get(key)?.setter;
                    if (setter) {
                        setter(beforeStates[key]);
                    }
                });
            };

            logOperationLocal(undoFunction, showToast);
            console.log(`Logged batch operation: ${operationType}`);
        },
        [logOperationLocal]
    );

    function performWithUndo(
        states: any[],
        setters: ((value: any) => void)[],
        operation: () => void,
        showToast: boolean = true
    ) {
        const beforeStates = states.map((state) => JSON.parse(JSON.stringify(state)));

        const undoFn = () => {
            states.forEach((_, index) => {
                setters[index](beforeStates[index]);
            });
        };

        console.log('Performing operation with undo for states');
        logOperationLocal(undoFn, showToast);
        operation();
        console.log('Operation performed, undo function logged');
    }

    async function performWithUndoForReducer(
        currentState: any,
        dispatch: (action: any) => void | Promise<any>,
        action: any,
        showToast: boolean = true
    ) {
        const previousState = currentState;
        // const undoFn = () => {
        //     dispatch({ type: 'RESTORE_STATE', payload: previousState });
        // };

        console.log('UNDO: Performing reducer action with undo:', action);

        const logUndoWithDiff = (res: { diff: any }) => {
            logOperationLocal(() => {
                dispatch({ type: 'RESTORE_DIFF', payload: res.diff });
            }, showToast);
        };
        // logOperationLocal(undoFn);
        console.log('UNDO: Logging reducer action with undo function, before dispatching');
        const result = dispatch(action);
        console.log('UNDO: Dispatching reducer action:', action, result, dispatch);
        if (result instanceof Promise) {
            console.log('UNDO: Dispatch is a promise, waiting for it to resolve');
            const res = await result;
            logUndoWithDiff(res);
            console.log('UNDO: Reducer action performed, undo (via diff) function logged', res);
        }
        console.log('UNDO: Reducer action dispatched, undo function logged');
    }

    // useEffect(() => {
    //     const handleKeyDown = (event: KeyboardEvent) => {
    //         if (event.ctrlKey && event.key === 'z') {
    //             console.log('Undo triggered via keyboard shortcut');
    //             undo();
    //         }
    //     };

    //     window.addEventListener('keydown', handleKeyDown);
    //     return () => {
    //         window.removeEventListener('keydown', handleKeyDown);
    //     };
    // }, [undo]);

    return {
        registerState,
        batchUpdate,
        performWithUndo,
        performWithUndoForReducer,
        batch
    };
}

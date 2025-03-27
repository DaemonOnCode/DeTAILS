import { useCallback, useEffect, useRef } from 'react';
import { useUndoContext } from '../../context/undo-context';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

type StateSetter<T> = (value: T) => void;

// Custom toast component with an undo button
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
        (undoFn: () => void) => {
            if (isBatching.current) {
                batchUndoFunctions.current.push(undoFn);
            } else {
                logOperation(undoFn);
                // Show toast notification with undo button
                toast.info(<UndoToast undo={undo} closeToast={() => toast.dismiss()} />, {
                    autoClose: 5000, // Toast disappears after 5 seconds
                    closeOnClick: false, // Prevent closing on click outside the button
                    draggable: false // Prevent dragging
                });
            }
        },
        [logOperation, undo]
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
        // Show toast for batch operation
        toast.info(<UndoToast undo={undo} closeToast={() => toast.dismiss()} />, {
            autoClose: 5000,
            closeOnClick: false,
            draggable: false
        });
        batchUndoFunctions.current = [];
    }, [logOperation, undo]);

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

    // Handle Ctrl + Z for undo
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.ctrlKey && event.key === 'z') {
                undo();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [undo]);

    return {
        registerState,
        batchUpdate,
        performWithUndo,
        performWithUndoForReducer,
        batch
    };
}

import React, {
    createContext,
    useReducer,
    useMemo,
    useState,
    useContext,
    useRef,
    useEffect
} from 'react';
import { ILayout } from '../types/Coding/shared';
import {
    ILoadingState,
    ILoadingContext,
    LoadingAction,
    StepHandle,
    ModalCallbacks
} from '../types/Shared';
import { ROUTES as SHARED_ROUTES } from '../constants/Shared';
import { ROUTES } from '../constants/Coding/shared';
import { loadingReducer } from '../reducers/loading';
import { useLocation } from 'react-router-dom';

const LoadingContext = createContext<ILoadingContext>({
    loadingState: {},
    loadingDispatch: () => {},
    registerStepRef: () => {},
    resetDataAfterPage: () => Promise.resolve(),
    checkIfDataExists: () => false,
    requestArrayRef: { current: {} },
    showProceedConfirmModal: false,
    setShowProceedConfirmModal: () => {},
    openModal: (_id: string, _callback: (e: React.MouseEvent) => void | Promise<void>) => {},
    updateContext: () => {},
    resetContext: () => {}
});

export const LoadingProvider: React.FC<ILayout> = ({ children }) => {
    const location = useLocation();
    const initialRefState: StepHandle = {
        validateStep: () => false,
        resetStep: () => {},
        checkDataExistence: () => false
    };

    const [modalCallbacks, setModalCallbacks] = useState<ModalCallbacks>({});
    const [activeModalId, setActiveModalId] = useState<string | null>(null);
    const [showProceedConfirmModal, setShowProceedConfirmModal] = useState(false);

    const openModal = (id: string, callback: (e: React.MouseEvent) => void) => {
        setModalCallbacks((prev) => ({ ...prev, [id]: callback }));
        setActiveModalId(id);
        setShowProceedConfirmModal(true);
    };

    // When confirmed, call the callback associated with the active modal ID.
    const handleConfirmProceed = async (e: React.MouseEvent) => {
        setShowProceedConfirmModal(false);
        if (activeModalId && modalCallbacks[activeModalId]) {
            const result = modalCallbacks[activeModalId](e);
            if (result !== undefined && typeof result.then === 'function') {
                await result;
            }
        }
        // Remove the callback for the active modal ID.
        setModalCallbacks((prev) => {
            const { [activeModalId as string]: _, ...rest } = prev;
            return rest;
        });
        setActiveModalId(null);
    };

    const handleCancelProceed = () => {
        setShowProceedConfirmModal(false);
    };

    const requestArrayRef = useRef<Record<string, ((...e: any) => void)[]> | null>({});
    const initialPageState: ILoadingState = {
        [`/${SHARED_ROUTES.CODING}/${ROUTES.BACKGROUND_RESEARCH}/${ROUTES.LLM_CONTEXT_V2}`]: {
            isLoading: false,
            isFirstRun: false,
            stepRef: useRef<StepHandle>(initialRefState)
        },
        [`/${SHARED_ROUTES.CODING}/${ROUTES.BACKGROUND_RESEARCH}/${ROUTES.KEYWORD_CLOUD}`]: {
            isLoading: false,
            isFirstRun: true,
            stepRef: useRef<StepHandle>(initialRefState)
        },
        [`/${SHARED_ROUTES.CODING}/${ROUTES.BACKGROUND_RESEARCH}/${ROUTES.KEYWORD_TABLE}`]: {
            isLoading: false,
            isFirstRun: true,
            downloadData: true,
            stepRef: useRef<StepHandle>(initialRefState)
        },
        [`/${SHARED_ROUTES.CODING}/${ROUTES.LOAD_DATA}/${ROUTES.DATA_SOURCE}`]: {
            isLoading: false,
            isFirstRun: true,
            stepRef: useRef<StepHandle>(initialRefState)
        },
        [`/${SHARED_ROUTES.CODING}/${ROUTES.LOAD_DATA}/${ROUTES.DATASET_CREATION}`]: {
            isLoading: false,
            isFirstRun: true,
            stepRef: useRef<StepHandle>(initialRefState)
        },
        [`/${SHARED_ROUTES.CODING}/${ROUTES.LOAD_DATA}/${ROUTES.DATA_VIEWER}`]: {
            isLoading: false,
            isFirstRun: true,
            stepRef: useRef<StepHandle>(initialRefState)
        },
        [`/${SHARED_ROUTES.CODING}/${ROUTES.CODEBOOK_CREATION}`]: {
            isLoading: false,
            isFirstRun: true,
            downloadData: true,
            stepRef: useRef<StepHandle>(initialRefState)
        },
        [`/${SHARED_ROUTES.CODING}/${ROUTES.DEDUCTIVE_CODING}`]: {
            isLoading: false,
            isFirstRun: true,
            downloadData: true,
            stepRef: useRef<StepHandle>(initialRefState)
        },
        [`/${SHARED_ROUTES.CODING}/${ROUTES.FINALIZING_CODES}`]: {
            isLoading: false,
            isFirstRun: true,
            downloadData: true,
            stepRef: useRef<StepHandle>(initialRefState)
        },
        [`/${SHARED_ROUTES.CODING}/${ROUTES.THEMATIC_ANALYSIS}/${ROUTES.THEMES}`]: {
            isLoading: false,
            isFirstRun: true,
            downloadData: true,
            stepRef: useRef<StepHandle>(initialRefState)
        },
        [`/${SHARED_ROUTES.CODING}/${ROUTES.THEMATIC_ANALYSIS}/${ROUTES.ANALYSIS}`]: {
            isLoading: false,
            isFirstRun: true,
            stepRef: useRef<StepHandle>(initialRefState)
        }
    };

    const [loadingState, loadingDispatch] = useReducer(loadingReducer, initialPageState);

    // useEffect(() => {
    //     Object.entries(initialPageState).forEach(([route, config]) => {
    //         loadingDispatch({
    //             type: 'REGISTER_STEP_REF',
    //             payload: {
    //                 route,
    //                 ref: config.stepRef,
    //                 defaultData: { isLoading: config.isLoading, downloadData: config.downloadData }
    //             }
    //         });
    //     });
    // }, []);

    useEffect(() => {
        console.log('Loading state changed:', loadingState);
    }, [loadingState]);
    // const [currentStepIndex, setCurrentStepIndex] = useState(0);

    const registerStepRef = (route: string, refObj?: React.RefObject<StepHandle>) => {
        loadingDispatch({
            type: 'REGISTER_STEP_REF',
            payload: {
                route,
                ref: refObj ?? initialPageState[route as keyof typeof initialPageState].stepRef
            }
        });
    };

    const checkIfDataExists = (page: string): boolean => {
        console.log('Checking data after page:', page);

        const appRoutes = Object.keys(initialPageState);
        const pageIndex = appRoutes.indexOf(page);
        if (pageIndex === -1) return false;

        // Get all routes after the specified page
        const routesAfterPage = appRoutes.slice(pageIndex + 1);

        // Return true if *any* later route's stepRef indicates data exists
        return routesAfterPage.some((route) => {
            const stepRef = loadingState[route]?.stepRef?.current;
            if (stepRef?.checkDataExistence) {
                console.log('Checking data existence for route:', route);
                return stepRef.checkDataExistence(route); // pass route if needed
            }
            return false;
        });
    };

    const resetDataAfterPage = async (page: string) => {
        console.log('Resetting data after page:', page);

        const appRoutes = Object.keys(initialPageState);
        const pageIndex = appRoutes.indexOf(page);
        if (pageIndex === -1) return;

        // Routes after the current page
        const routesToReset = appRoutes.slice(pageIndex + 1);

        // 1. Download data for each route (in sequence, awaiting each one)
        for (const route of routesToReset) {
            const stepRef = loadingState[route]?.stepRef.current;
            if (stepRef?.downloadData) {
                try {
                    console.log('Downloading data for route:', route);
                    await stepRef.downloadData(route); // Wait for it to finish
                } catch (err) {
                    console.error(`Error downloading data for route "${route}":`, err);
                }
            }
        }

        loadingDispatch({
            type: 'SET_REST_UNDONE',
            route: page
        });
        // 2. After all downloads are complete, reset the routes
        for (const route of routesToReset) {
            console.log('Dispatching RESET_PAGE_DATA for:', route);
            loadingDispatch({
                type: 'RESET_PAGE_DATA',
                payload: { route }
            });
            if (requestArrayRef?.current && requestArrayRef.current[route]) {
                requestArrayRef.current[route].forEach((abort) => {
                    console.log('Aborting request:', route);
                    abort();
                });
                requestArrayRef.current[route] = [];
            }
        }
    };

    useEffect(() => {
        console.log("Inside loading context's useEffect", location.pathname);
        // return () => {
        console.log('Cleanup loading context:', location.pathname);
        if (location.pathname === `/${SHARED_ROUTES.WORKSPACE}`) {
            console.log('Aborting requests:', requestArrayRef.current);
            if (!requestArrayRef.current) return;
            Object.entries(requestArrayRef.current).forEach(([route, abortArray]) => {
                if (route === `/${SHARED_ROUTES.WORKSPACE}`) return;
                abortArray.forEach((abort) => {
                    abort(new Error('Operation cancelled: Moved out of workspace'));
                });
            });

            for (const route in requestArrayRef.current) {
                requestArrayRef.current[route] = [];
            }
        }
        // };
    }, [location.pathname]);

    const updateContext = (updates: {
        pageState: {
            [route: string]: boolean;
        };
    }) => {
        loadingDispatch({
            type: 'UPDATE_PAGE_STATE',
            payload: updates.pageState
        });
    };

    const resetContext = () => {
        loadingDispatch({
            type: 'SET_REST_UNDONE',
            route: Object.keys(initialPageState)[0]
        });
    };

    const value = useMemo(
        () => ({
            loadingState,
            loadingDispatch,
            // currentStepIndex,
            registerStepRef,
            resetDataAfterPage,
            checkIfDataExists,
            showProceedConfirmModal,
            setShowProceedConfirmModal,
            openModal,
            requestArrayRef,
            updateContext,
            resetContext
        }),
        [loadingState, showProceedConfirmModal]
    );

    return (
        <LoadingContext.Provider value={value}>
            {children}
            {showProceedConfirmModal && (
                <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50 z-50">
                    <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
                        <h2 className="text-xl font-bold mb-4">Confirm Proceed</h2>
                        <p className="mb-4">
                            Proceeding will remove unsaved data. Are you sure you want to continue?
                        </p>
                        <div className="flex justify-end">
                            <button
                                onClick={handleCancelProceed}
                                className="mr-4 bg-gray-300 px-4 py-2 rounded-md hover:bg-gray-400">
                                Cancel
                            </button>
                            <button
                                onClick={(e) => handleConfirmProceed(e)}
                                className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600">
                                Yes, Proceed
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </LoadingContext.Provider>
    );
};

export const useLoadingContext = () => useContext(LoadingContext);

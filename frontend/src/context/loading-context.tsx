import React, {
    createContext,
    useReducer,
    useMemo,
    useState,
    useContext,
    useRef,
    useEffect,
    useCallback
} from 'react';
import { ILayout } from '../types/Coding/shared';
import { ILoadingState, ILoadingContext, StepHandle, ModalCallbacks } from '../types/Shared';
import { ROUTES as SHARED_ROUTES } from '../constants/Shared';
import {
    PAGE_ROUTES as CODING_PAGE_ROUTES,
    LOADER_ROUTES as CODING_LOADER_ROUTES
} from '../constants/Coding/shared';
import { loadingReducer } from '../reducers/loading';
import { useLocation } from 'react-router-dom';

const { ipcRenderer } = window.require('electron');

const LoadingContext = createContext<ILoadingContext>({
    loadingState: {},
    loadingDispatch: () => {},
    registerStepRef: () => {},
    resetDataAfterPage: () => Promise.resolve(),
    checkIfDataExists: async () => false,
    requestArrayRef: { current: {} },
    showProceedConfirmModal: false,
    setShowProceedConfirmModal: () => {},
    openModal: (_id: string, _callback: (e: React.MouseEvent) => void | Promise<void>) => {},
    updateContext: () => {},
    resetContext: () => {},
    abortRequests: () => {},
    abortRequestsByRoute: () => {},
    openCredentialModalForCredentialError: () => {},
    isStateLocked: () => false,
    lockedUpdate: async () => {}
});

export const LoadingProvider: React.FC<ILayout> = ({ children }) => {
    const location = useLocation();
    const initialRefState: StepHandle = {
        validateStep: () => false,
        resetStep: async () => {},
        checkDataExistence: async () => false
    };

    const [showDownloadModal, setShowDownloadModal] = useState(false);

    const [modalCallbacks, setModalCallbacks] = useState<ModalCallbacks>({});
    const [activeModalId, setActiveModalId] = useState<string | null>(null);
    const [showProceedConfirmModal, setShowProceedConfirmModal] = useState(false);

    const [showCredentialModal, setShowCredentialModal] = useState<boolean>(false);
    const [credentialErrorMessage, setCredentialErrorMessage] = useState<string>('');
    const [credentialModalResolver, setCredentialModalResolver] = useState<
        ((newPath: string | null) => void) | null
    >(null);

    const openModal = (id: string, callback: (e: React.MouseEvent) => void) => {
        setModalCallbacks((prev) => ({ ...prev, [id]: callback }));
        setActiveModalId(id);
        setShowProceedConfirmModal(true);
    };

    const openCredentialModalForCredentialError = (
        errorMessage: string,
        resolver: (newPath: string) => void
    ) => {
        setCredentialErrorMessage(errorMessage);
        setCredentialModalResolver(() => resolver);
        setShowCredentialModal(true);
    };

    const handleDownloadAndProceed = async (e: React.MouseEvent) => {
        try {
            setShowProceedConfirmModal(false);
            await resetDataAfterPage(location.pathname, true);
            if (activeModalId && modalCallbacks[activeModalId]) {
                const result = modalCallbacks[activeModalId](e);
                if (result instanceof Promise) {
                    await result;
                }
            }
            setModalCallbacks((prev) => {
                const { [activeModalId as string]: _, ...rest } = prev;
                return rest;
            });
            setActiveModalId(null);
        } catch (error) {
            console.error('Error in handleDownloadAndProceed:', error);
        }
    };

    const handleProceedWithoutDownload = async (e: React.MouseEvent) => {
        try {
            setShowProceedConfirmModal(false);
            await resetDataAfterPage(location.pathname, false);
            if (activeModalId && modalCallbacks[activeModalId]) {
                const result = modalCallbacks[activeModalId](e);
                if (result instanceof Promise) {
                    await result;
                }
            }
            setModalCallbacks((prev) => {
                const { [activeModalId as string]: _, ...rest } = prev;
                return rest;
            });
            setActiveModalId(null);
        } catch (error) {
            console.error('Error in handleProceedWithoutDownload:', error);
        }
    };

    const handleCancelProceed = () => {
        setShowProceedConfirmModal(false);
    };

    const initialPageState: ILoadingState = {
        [CODING_PAGE_ROUTES.CONTEXT]: {
            isLoading: false,
            isFirstRun: false,
            stepRef: useRef<StepHandle>(initialRefState)
        },
        [CODING_PAGE_ROUTES.RELATED_CONCEPTS]: {
            isLoading: false,
            isFirstRun: true,
            stepRef: useRef<StepHandle>(initialRefState)
        },
        [CODING_PAGE_ROUTES.CONCEPT_OUTLINE]: {
            isLoading: false,
            isFirstRun: true,
            downloadData: true,
            stepRef: useRef<StepHandle>(initialRefState)
        },
        [CODING_PAGE_ROUTES.DATA_TYPE]: {
            isLoading: false,
            isFirstRun: true,
            stepRef: useRef<StepHandle>(initialRefState)
        },
        [CODING_PAGE_ROUTES.DATA_SOURCE]: {
            isLoading: false,
            isFirstRun: true,
            stepRef: useRef<StepHandle>(initialRefState)
        },
        [CODING_PAGE_ROUTES.DATASET_CREATION]: {
            isLoading: false,
            isFirstRun: true,
            stepRef: useRef<StepHandle>(initialRefState)
        },
        [CODING_PAGE_ROUTES.INITIAL_CODING]: {
            isLoading: false,
            isFirstRun: true,
            downloadData: true,
            stepRef: useRef<StepHandle>(initialRefState)
        },
        [CODING_PAGE_ROUTES.INITIAL_CODEBOOK]: {
            isLoading: false,
            isFirstRun: true,
            downloadData: true,
            stepRef: useRef<StepHandle>(initialRefState)
        },
        [CODING_PAGE_ROUTES.FINAL_CODING]: {
            isLoading: false,
            isFirstRun: true,
            downloadData: true,
            stepRef: useRef<StepHandle>(initialRefState)
        },
        [CODING_PAGE_ROUTES.REVIEWING_CODES]: {
            isLoading: false,
            isFirstRun: true,
            downloadData: true,
            stepRef: useRef<StepHandle>(initialRefState)
        },
        [CODING_PAGE_ROUTES.GENERATING_THEMES]: {
            isLoading: false,
            isFirstRun: true,
            downloadData: true,
            stepRef: useRef<StepHandle>(initialRefState)
        },
        [CODING_PAGE_ROUTES.REPORT]: {
            isLoading: false,
            isFirstRun: true,
            stepRef: useRef<StepHandle>(initialRefState)
        },
        [CODING_PAGE_ROUTES.MANUAL_CODING]: {
            isLoading: false,
            isFirstRun: true,
            stepRef: useRef<StepHandle>(initialRefState)
        }
    };

    const requestArrayRef = useRef<Record<string, ((...e: any) => void)[]> | null>(
        Object.fromEntries(Object.keys(initialPageState).map((route) => [route, []]))
    );
    const [loadingState, loadingDispatch] = useReducer(loadingReducer, initialPageState);

    useEffect(() => {
        console.log('Loading state changed:', loadingState);
    }, [loadingState]);

    const registerStepRef = (route: string, refObj?: React.RefObject<StepHandle>) => {
        loadingDispatch({
            type: 'REGISTER_STEP_REF',
            payload: {
                route,
                ref: refObj ?? initialPageState[route as keyof typeof initialPageState].stepRef
            }
        });
    };

    const checkIfDataExists = async (page: string): Promise<boolean> => {
        console.log('Checking data after page:', page);

        const appRoutes = Object.keys(initialPageState);
        const pageIndex = appRoutes.indexOf(page);
        if (pageIndex === -1) return false;

        const routesAfterPage = appRoutes.slice(pageIndex + 1);
        for (const route of routesAfterPage) {
            const stepRef = loadingState[route]?.stepRef?.current;
            if (stepRef?.checkDataExistence) {
                console.log('Checking data existence for route:', route);
                const exists = await stepRef.checkDataExistence(route);
                if (exists) return true;
            }
        }
    };

    const abortRequests = (route: string) => {
        const routeIdx = Object.keys(initialPageState).indexOf(route);
        console.log('Aborting requests for route:', route, routeIdx);
        Object.keys(initialPageState).forEach((route, idx) => {
            if (routeIdx <= idx && requestArrayRef.current) {
                console.log('Aborting request:', route, requestArrayRef.current[route]);
                (requestArrayRef.current[route] ?? []).forEach((abort) => {
                    abort({
                        name: 'AbortError',
                        message: 'Operation cancelled: Moved out of workspace'
                    });
                });
                requestArrayRef.current[route] = [];
            }
        });
    };

    const abortRequestsByRoute = (route: string) => {
        console.log('Aborting requests for route:', route, requestArrayRef.current);
        if (requestArrayRef.current && requestArrayRef.current[route]) {
            requestArrayRef.current[route].forEach((abort) => {
                console.log('Aborting request:', route);
                abort({
                    name: 'AbortError',
                    message: 'Operation cancelled: Moved out of workspace'
                });
            });
            requestArrayRef.current[route] = [];
        }
    };

    const resetDataAfterPage = async (page: string, download = false) => {
        console.log('Resetting data after page:', page);

        const appRoutes = Object.keys(initialPageState);
        const pageIndex = appRoutes.indexOf(page);
        console.log('Page index:', pageIndex);
        if (pageIndex === -1) return;

        const routesToReset = appRoutes.slice(pageIndex + 1);

        if (download) {
            for (const route of routesToReset) {
                const stepRef = loadingState[route]?.stepRef.current;
                if (stepRef?.downloadData) {
                    try {
                        console.log('Downloading data for route:', route);
                        setShowDownloadModal(true);
                        await stepRef.downloadData(route);
                        setShowDownloadModal(false);
                    } catch (err) {
                        console.error(`Error downloading data for route "${route}":`, err);
                        setShowDownloadModal(false);
                    }
                }
            }
        }

        loadingDispatch({
            type: 'SET_REST_UNDONE',
            route: page
        });
        for (const route of routesToReset) {
            console.log('Dispatching RESET_PAGE_DATA for:', route);
            loadingDispatch({
                type: 'RESET_PAGE_DATA',
                payload: { route }
            });
            abortRequests(route);
        }
    };

    const isStateLocked = (currentRoute: string) => {
        console.log('Checking if state is locked for route:', currentRoute);
        const appRoutes = Object.keys(initialPageState);
        const currentIndex = appRoutes.indexOf(currentRoute);
        if (currentIndex === -1) return false;
        console.log('Current route index:', currentIndex);
        const subsequentRoutes = appRoutes.slice(currentIndex + 1);
        for (const route of subsequentRoutes) {
            const state = loadingState[route];
            if (state.isLoading || !state.isFirstRun) {
                console.log(
                    'State is locked for route:',
                    route,
                    state.isLoading || !state.isFirstRun
                );
                return true;
            }
        }
        return false;
    };

    const lockedUpdate = useCallback(
        async (id: string, updateFn: () => Promise<any>) => {
            if (!isStateLocked(location.pathname)) {
                console.log('State is not locked, proceeding with update:', id);
                return updateFn();
            } else {
                console.log('State is locked, showing modal:', id);
                return new Promise((resolve) => {
                    openModal(id, async (e) => {
                        try {
                            const result = await updateFn();
                            resolve(result);
                        } catch (error) {
                            resolve({ success: false, error });
                        }
                    });
                });
            }
        },
        [location.pathname]
    );

    useEffect(() => {
        console.log("Inside loading context's useEffect", location.pathname);
        console.log('Cleanup loading context:', location.pathname);
        if (location.pathname === `/${SHARED_ROUTES.WORKSPACE}`) {
            console.log('Aborting requests:', requestArrayRef.current);
            if (!requestArrayRef.current) return;
            Object.entries(requestArrayRef.current).forEach(([route, abortArray]) => {
                if (route === `/${SHARED_ROUTES.WORKSPACE}`) return;
                abortArray.forEach((abort) => {
                    abort({
                        name: 'AbortError',
                        message: 'Operation cancelled: Moved out of workspace'
                    });
                });
            });

            for (const route in requestArrayRef.current) {
                requestArrayRef.current[route] = [];
            }
        }
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
        console.log('Resetting context');
        Object.keys(initialPageState).forEach((route) => {
            loadingDispatch({
                type: 'SET_LOADING_DONE_ROUTE',
                route
            });
        });
        loadingDispatch({
            type: 'SET_REST_UNDONE',
            route: Object.keys(initialPageState)[0]
        });
    };

    const value = useMemo(
        () => ({
            loadingState,
            loadingDispatch,
            registerStepRef,
            resetDataAfterPage,
            checkIfDataExists,
            showProceedConfirmModal,
            setShowProceedConfirmModal,
            openModal,
            requestArrayRef,
            updateContext,
            resetContext,
            abortRequests,
            abortRequestsByRoute,
            openCredentialModalForCredentialError,
            isStateLocked,
            lockedUpdate
        }),
        [loadingState, showProceedConfirmModal, lockedUpdate]
    );

    return (
        <LoadingContext.Provider value={value}>
            {children}
            {showProceedConfirmModal && (
                <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50 z-50">
                    <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
                        <h2 className="text-xl font-bold mb-4">Confirm Proceed</h2>
                        <p className="mb-4">
                            Proceeding will remove unsaved data. Would you like to download your
                            data before proceeding?
                        </p>
                        <div className="flex justify-end space-x-4">
                            <button
                                onClick={handleCancelProceed}
                                className="bg-gray-300 px-4 py-2 rounded-md hover:bg-gray-400">
                                Cancel
                            </button>
                            <button
                                onClick={(e) => handleDownloadAndProceed(e)}
                                className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600">
                                Download and Proceed
                            </button>
                            <button
                                onClick={(e) => handleProceedWithoutDownload(e)}
                                className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600">
                                Proceed Without Download
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {showDownloadModal && (
                <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50 z-50">
                    <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
                        <h2 className="text-xl font-bold mb-4">Downloading</h2>
                        <p className="mb-4">Your file is being downloaded...</p>
                    </div>
                </div>
            )}
            {showCredentialModal && (
                <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50 z-50">
                    <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
                        <h2 className="text-xl font-bold mb-4">Credential Error</h2>
                        <p className="mb-4">{credentialErrorMessage}</p>
                        <div className="flex justify-end space-x-4">
                            <button
                                onClick={async (e) => {
                                    if (credentialModalResolver) {
                                        const newPath = await ipcRenderer.invoke('select-file', [
                                            'json'
                                        ]);
                                        console.log('Selected file:', newPath);
                                        credentialModalResolver(newPath);
                                        setShowCredentialModal(false);
                                    }
                                }}
                                className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600">
                                Choose Credential File
                            </button>
                            <button
                                onClick={(e) => {
                                    if (credentialModalResolver) {
                                        credentialModalResolver(null);
                                    }
                                    setShowCredentialModal(false);
                                }}
                                className="bg-gray-300 px-4 py-2 rounded-md hover:bg-gray-400">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </LoadingContext.Provider>
    );
};

export const useLoadingContext = () => useContext(LoadingContext);

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
import { ILoadingState, ILoadingContext, LoadingAction, StepHandle } from '../types/Shared';
import { ROUTES as SHARED_ROUTES } from '../constants/Shared';
import { ROUTES } from '../constants/Coding/shared';
import { loadingReducer } from '../reducers/loading';

const LoadingContext = createContext<ILoadingContext>({
    loadingState: {},
    loadingDispatch: () => {},
    registerStepRef: () => {},
    resetDataAfterPage: () => Promise.resolve(),
    checkIfDataExists: () => false
});

export const LoadingProvider: React.FC<ILayout> = ({ children }) => {
    const initialRefState: StepHandle = {
        validateStep: () => false,
        resetStep: () => {},
        checkDataExistence: () => false
    };
    const initialPageState: ILoadingState = {
        [`/${SHARED_ROUTES.CODING}/${ROUTES.BACKGROUND_RESEARCH}/${ROUTES.LLM_CONTEXT_V2}`]: {
            isLoading: false,
            stepRef: useRef<StepHandle>(initialRefState)
        },
        [`/${SHARED_ROUTES.CODING}/${ROUTES.BACKGROUND_RESEARCH}/${ROUTES.KEYWORD_CLOUD}`]: {
            isLoading: false,
            stepRef: useRef<StepHandle>(initialRefState)
        },
        [`/${SHARED_ROUTES.CODING}/${ROUTES.BACKGROUND_RESEARCH}/${ROUTES.KEYWORD_TABLE}`]: {
            isLoading: false,
            downloadData: true,
            stepRef: useRef<StepHandle>(initialRefState)
        },
        [`/${SHARED_ROUTES.CODING}/${ROUTES.LOAD_DATA}/${ROUTES.DATA_SOURCE}`]: {
            isLoading: false,
            stepRef: useRef<StepHandle>(initialRefState)
        },
        [`/${SHARED_ROUTES.CODING}/${ROUTES.LOAD_DATA}/${ROUTES.DATASET_CREATION}`]: {
            isLoading: false,
            stepRef: useRef<StepHandle>(initialRefState)
        },
        [`/${SHARED_ROUTES.CODING}/${ROUTES.LOAD_DATA}/${ROUTES.DATA_VIEWER}`]: {
            isLoading: false,
            stepRef: useRef<StepHandle>(initialRefState)
        },
        [`/${SHARED_ROUTES.CODING}/${ROUTES.CODEBOOK_CREATION}`]: {
            isLoading: false,
            downloadData: true,
            stepRef: useRef<StepHandle>(initialRefState)
        },
        [`/${SHARED_ROUTES.CODING}/${ROUTES.DEDUCTIVE_CODING}`]: {
            isLoading: false,
            downloadData: true,
            stepRef: useRef<StepHandle>(initialRefState)
        },
        [`/${SHARED_ROUTES.CODING}/${ROUTES.THEMATIC_ANALYSIS}/${ROUTES.THEMES}`]: {
            isLoading: false,
            downloadData: true,
            stepRef: useRef<StepHandle>(initialRefState)
        },
        [`/${SHARED_ROUTES.CODING}/${ROUTES.THEMATIC_ANALYSIS}/${ROUTES.ANALYSIS}`]: {
            isLoading: false,
            stepRef: useRef<StepHandle>(initialRefState)
        }
    };

    const [loadingState, loadingDispatch] = useReducer(loadingReducer, {});

    useEffect(() => {
        Object.entries(initialPageState).forEach(([route, config]) => {
            loadingDispatch({
                type: 'REGISTER_STEP_REF',
                payload: {
                    route,
                    ref: config.stepRef,
                    defaultData: { isLoading: config.isLoading, downloadData: config.downloadData }
                }
            });
        });
    }, []);

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

        // 2. After all downloads are complete, reset the routes
        for (const route of routesToReset) {
            console.log('Dispatching RESET_PAGE_DATA for:', route);
            loadingDispatch({
                type: 'RESET_PAGE_DATA',
                payload: { route }
            });
        }
    };

    const value = useMemo(
        () => ({
            loadingState,
            loadingDispatch,
            // currentStepIndex,
            registerStepRef,
            resetDataAfterPage,
            checkIfDataExists
        }),
        [loadingState]
    );

    return <LoadingContext.Provider value={value}>{children}</LoadingContext.Provider>;
};

export const useLoadingContext = () => useContext(LoadingContext);

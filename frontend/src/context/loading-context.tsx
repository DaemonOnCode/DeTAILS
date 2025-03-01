import React, { createContext, useReducer, useMemo, useState, useContext, useRef } from 'react';
import { ILayout } from '../types/Coding/shared';
import { ILoadingState, ILoadingContext, LoadingAction, StepHandle } from '../types/Shared';
import { ROUTES as SHARED_ROUTES } from '../constants/Shared';
import { ROUTES } from '../constants/Coding/shared';

const loadingReducer = (state: ILoadingState, action: LoadingAction): ILoadingState => {
    console.log(action, state, 'in lc');
    switch (action.type) {
        case 'SET_LOADING': {
            const { route, loading } = action.payload;
            return {
                ...state,
                [route]: { ...state[route], isLoading: loading }
            };
        }
        case 'RESET_LOADING':
            return {};
        case 'SET_LOADING_ALL':
            return Object.keys(state).reduce(
                (acc, key) => ({ ...acc, [key]: { ...state[key], isLoading: action.payload } }),
                {}
            );
        case 'SET_LOADING_ROUTE': {
            const { route } = action;
            return {
                ...state,
                [route]: { ...state[route], isLoading: true }
            };
        }
        case 'SET_LOADING_DONE_ROUTE': {
            const { route } = action;
            return {
                ...state,
                [route]: { ...state[route], isLoading: false }
            };
        }
        case 'REGISTER_STEP_REF': {
            const { route, ref } = action.payload;
            return {
                ...state,
                [route]: { ...state[route], stepRef: ref }
            };
        }
        case 'RESET_PAGE_DATA': {
            const { route, defaultData } = action.payload;
            state[route].stepRef.current?.resetStep();
            return state;
            // return {
            //     ...state,
            //     [route]: defaultData
            // };
        }
        default:
            return state;
    }
};

const LoadingContext = createContext<ILoadingContext>({
    loadingState: {},
    loadingDispatch: () => {},
    registerStepRef: () => {},
    resetDataAfterPage: (page: string) => {}
});

export const LoadingProvider: React.FC<ILayout> = ({ children }) => {
    const initialPageState: ILoadingState = {
        [`/${SHARED_ROUTES.CODING}/${ROUTES.BACKGROUND_RESEARCH}/${ROUTES.LLM_CONTEXT_V2}`]: {
            isLoading: false,
            stepRef: useRef<StepHandle>(null)
        },
        [`/${SHARED_ROUTES.CODING}/${ROUTES.BACKGROUND_RESEARCH}/${ROUTES.KEYWORD_CLOUD}`]: {
            isLoading: false,
            stepRef: useRef<StepHandle>(null)
        },
        [`/${SHARED_ROUTES.CODING}/${ROUTES.BACKGROUND_RESEARCH}/${ROUTES.KEYWORD_TABLE}`]: {
            isLoading: false,
            downloadData: true,
            stepRef: useRef<StepHandle>(null)
        },
        [`/${SHARED_ROUTES.CODING}/${ROUTES.LOAD_DATA}/${ROUTES.DATA_SOURCE}`]: {
            isLoading: false,
            stepRef: useRef<StepHandle>(null)
        },
        [`/${SHARED_ROUTES.CODING}/${ROUTES.LOAD_DATA}/${ROUTES.DATASET_CREATION}`]: {
            isLoading: false,
            stepRef: useRef<StepHandle>(null)
        },
        [`/${SHARED_ROUTES.CODING}/${ROUTES.CODEBOOK_CREATION}`]: {
            isLoading: false,
            downloadData: true,
            stepRef: useRef<StepHandle>(null)
        },
        [`/${SHARED_ROUTES.CODING}/${ROUTES.DEDUCTIVE_CODING}`]: {
            isLoading: false,
            downloadData: true,
            stepRef: useRef<StepHandle>(null)
        },
        [`/${SHARED_ROUTES.CODING}/${ROUTES.THEMATIC_ANALYSIS}/${ROUTES.THEMES}`]: {
            isLoading: false,
            downloadData: true,
            stepRef: useRef<StepHandle>(null)
        },
        [`/${SHARED_ROUTES.CODING}/${ROUTES.THEMATIC_ANALYSIS}/${ROUTES.ANALYSIS}`]: {
            isLoading: false,
            stepRef: useRef<StepHandle>(null)
        }
    };

    const [loadingState, loadingDispatch] = useReducer(loadingReducer, initialPageState);
    // const [currentStepIndex, setCurrentStepIndex] = useState(0);

    const registerStepRef = (route: string, refObj: React.RefObject<StepHandle | null>) => {
        loadingDispatch({ type: 'REGISTER_STEP_REF', payload: { route, ref: refObj } });
    };

    const resetDataAfterPage = (page: string) => {
        // Assume the wizard pages are in the insertion order of initialPageState.

        const appRoutes = Object.keys(initialPageState);
        const pageIndex = appRoutes.indexOf(page);
        if (pageIndex === -1) return;
        // Reset every page after the provided page.
        appRoutes.forEach((route, index) => {
            if (index > pageIndex) {
                loadingDispatch({
                    type: 'RESET_PAGE_DATA',
                    payload: { route, defaultData: initialPageState[route] }
                });
            }
        });
    };

    const value = useMemo(
        () => ({
            loadingState,
            loadingDispatch,
            // currentStepIndex,
            registerStepRef,
            resetDataAfterPage
        }),
        [loadingState]
    );

    return <LoadingContext.Provider value={value}>{children}</LoadingContext.Provider>;
};

export const useLoadingContext = () => useContext(LoadingContext);

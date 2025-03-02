import React, { createContext, useReducer, useMemo, useState, useContext, useRef } from 'react';
import { ILayout } from '../types/Coding/shared';
import { ILoadingState, ILoadingContext, LoadingAction, StepHandle } from '../types/Shared';
import { ROUTES as SHARED_ROUTES } from '../constants/Shared';
import { ROUTES } from '../constants/Coding/shared';
import { loadingReducer } from '../reducers/loading';

const LoadingContext = createContext<ILoadingContext>({
    loadingState: {},
    loadingDispatch: () => {},
    registerStepRef: () => {},
    resetDataAfterPage: () => {}
});

export const LoadingProvider: React.FC<ILayout> = ({ children }) => {
    const initialRefState: StepHandle = {
        validateStep: () => false,
        resetStep: () => {},
        checkDataExistence: () => false
    };
    const initialPageState = {
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

    const [loadingState, loadingDispatch] = useReducer(loadingReducer, initialPageState);
    // const [currentStepIndex, setCurrentStepIndex] = useState(0);

    const registerStepRef = (route: string, refObj: React.RefObject<StepHandle>) => {
        loadingDispatch({ type: 'REGISTER_STEP_REF', payload: { route, ref: refObj } });
    };

    const resetDataAfterPage = (page: string) => {
        // Assume the wizard pages are in the insertion order of initialPageState.
        console.log('Resetting data after page:', page);
        const appRoutes = Object.keys(initialPageState);
        const pageIndex = appRoutes.indexOf(page);
        if (pageIndex === -1) return;
        // Reset every page after the provided page.
        loadingDispatch({
            type: 'RESET_PAGE_DATA',
            payload: { route: page }
        });
        // appRoutes.forEach((route, index) => {
        //     if (index > pageIndex) {
        //         console.log(
        //             'Resetting:',
        //             route,
        //             index,
        //             loadingState[route],
        //             loadingState[route]?.stepRef.current?.resetStep
        //         );
        //         loadingDispatch({
        //             type: 'RESET_PAGE_DATA',
        //             payload: { route }
        //         });
        //     }
        // });
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

import { createContext, FC, useContext, useReducer, useMemo } from 'react';
import { ILayout } from '../types/Coding/shared';
import { ILoadingState, ILoadingContext, LoadingAction } from '../types/Shared';
import { ROUTES as SHARED_ROUTES } from '../constants/Shared';
import { ROUTES } from '../constants/Coding/shared';

const loadingReducer = (state: ILoadingState, action: LoadingAction): ILoadingState => {
    switch (action.type) {
        case 'SET_LOADING': {
            const { route, loading } = action.payload;
            return {
                ...state,
                [route]: {
                    isLoading: loading
                }
            };
        }
        case 'RESET_LOADING':
            return {};
        case 'SET_LOADING_ALL':
            return Object.keys(state).reduce((acc, key) => ({ ...acc, [key]: action.payload }), {});
        case 'SET_LOADING_ROUTE': {
            const { route } = action;
            return {
                ...state,
                [route]: {
                    isLoading: true
                }
            };
        }
        case 'SET_LOADING_DONE_ROUTE': {
            const { route } = action;
            return {
                ...state,
                [route]: {
                    isLoading: false
                }
            };
        }

        default:
            return state;
    }
};

const LoadingContext = createContext<ILoadingContext>({
    loadingState: {},
    loadingDispatch: () => {}
});

export const LoadingProvider: FC<ILayout> = ({ children }) => {
    const initialPageState = {
        [`/${SHARED_ROUTES.CODING}/${ROUTES.BACKGROUND_RESEARCH}/${ROUTES.LLM_CONTEXT_V2}`]: {
            isLoading: false
        },
        [`/${SHARED_ROUTES.CODING}/${ROUTES.BACKGROUND_RESEARCH}/${ROUTES.KEYWORD_CLOUD}`]: {
            isLoading: false
        },
        [`/${SHARED_ROUTES.CODING}/${ROUTES.BACKGROUND_RESEARCH}/${ROUTES.KEYWORD_TABLE}`]: {
            isLoading: false,
            downloadData: true
        },
        [`/${SHARED_ROUTES.CODING}/${ROUTES.LOAD_DATA}/${ROUTES.DATA_SOURCE}`]: {
            isLoading: false
        },
        [`/${SHARED_ROUTES.CODING}/${ROUTES.LOAD_DATA}/${ROUTES.DATASET_CREATION}`]: {
            isLoading: false
        },
        [`/${SHARED_ROUTES.CODING}/${ROUTES.CODEBOOK_CREATION}`]: {
            isLoading: false,
            downloadData: true
        },
        [`/${SHARED_ROUTES.CODING}/${ROUTES.DEDUCTIVE_CODING}`]: {
            isLoading: false,
            downloadData: true
        },
        [`/${SHARED_ROUTES.CODING}/${ROUTES.THEMATIC_ANALYSIS}/${ROUTES.THEMES}`]: {
            isLoading: false,
            downloadData: true
        },
        [`/${SHARED_ROUTES.CODING}/${ROUTES.THEMATIC_ANALYSIS}/${ROUTES.ANALYSIS}`]: {
            isLoading: false
        }
    };
    const [loadingState, loadingDispatch] = useReducer(loadingReducer, initialPageState);

    const value = useMemo(() => ({ loadingDispatch, loadingState }), [loadingState]);

    return <LoadingContext.Provider value={value}>{children}</LoadingContext.Provider>;
};

export const useLoadingContext = () => useContext(LoadingContext);

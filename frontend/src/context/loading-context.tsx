import { createContext, FC, useContext, useReducer, useMemo } from 'react';
import { ILayout } from '../types/Coding/shared';
import { ILoadingState, ILoadingContext, LoadingAction } from '../types/Shared';

const loadingReducer = (state: ILoadingState, action: LoadingAction): ILoadingState => {
    switch (action.type) {
        case 'SET_LOADING': {
            const { route, loading } = action.payload;
            return {
                ...state,
                [route]: loading
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
                [route]: true
            };
        }
        case 'SET_LOADING_DONE_ROUTE': {
            const { route } = action;
            return {
                ...state,
                [route]: false
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
    const [loadingState, loadingDispatch] = useReducer(loadingReducer, {});

    const value = useMemo(() => ({ loadingDispatch, loadingState }), [loadingState]);

    return <LoadingContext.Provider value={value}>{children}</LoadingContext.Provider>;
};

export const useLoadingContext = () => useContext(LoadingContext);

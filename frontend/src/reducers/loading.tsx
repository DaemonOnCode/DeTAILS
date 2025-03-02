import { ILoadingState, LoadingAction } from '../types/Shared';

export const loadingReducer = (state: ILoadingState, action: LoadingAction): ILoadingState => {
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
        case 'REGISTER_STEP_REF_MULTIPLE': {
            const payload = action.payload;
            payload.forEach((item) => {
                const { route, ref } = item;
                state[route].stepRef = ref;
            });
            return state;
        }
        case 'RESET_PAGE_DATA': {
            const { route, defaultData } = action.payload;
            state[route].stepRef.current?.resetStep(route);
            return state;
        }
        default:
            return state;
    }
};

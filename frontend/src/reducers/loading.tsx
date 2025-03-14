import { ILoadingState, LoadingAction } from '../types/Shared';

export const loadingReducer = (state: ILoadingState, action: LoadingAction): ILoadingState => {
    console.log('loadingReducer action:', action, 'state:', state);
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
            const { route, ref, defaultData } = action.payload;
            return {
                ...state,
                [route]: { ...state[route], stepRef: ref, ...defaultData }
            };
        }
        case 'REGISTER_STEP_REF_MULTIPLE': {
            const payload = action.payload;
            payload.forEach((item) => {
                const { route, ref } = item;
                state[route].stepRef = ref;
            });
            return { ...state };
        }
        case 'RESET_PAGE_DATA': {
            const { route, defaultData } = action.payload;
            state[route].stepRef.current?.resetStep(route);
            return state;
        }
        case 'SET_FIRST_RUN_DONE':
            const doneAfter = action.route;
            let donePageIndex = Object.keys(state).indexOf(doneAfter) + 1;
            state[Object.keys(state)[donePageIndex]].isFirstRun = false;
            return { ...state };
        case 'SET_REST_UNDONE':
            const resetAfter = action.route;
            let pageIndex = Object.keys(state).indexOf(resetAfter);

            console.log('Resetting after:', resetAfter, 'Index:', pageIndex, Object.keys(state));
            Object.keys(state).forEach((key, idx) => {
                if (idx > pageIndex) {
                    state[key].isFirstRun = true;
                }
            });
            return { ...state };
        case 'UPDATE_PAGE_STATE': {
            const pageState = action.payload; // payload is the complete page state object
            Object.entries(pageState).forEach(([route, isFirstRun]) => {
                if (state[route]) {
                    state[route].isFirstRun = isFirstRun ?? true;
                }
            });
            return { ...state };
        }

        // return { ...state };
        default:
            return state;
    }
};

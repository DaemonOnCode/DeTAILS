import { FaCog, FaHome } from 'react-icons/fa';
import config from '../../config';
import {
    LOADER_ROUTES as CODING_LOADER_ROUTES,
    CODING_ROUTES,
    PAGE_ROUTES as CODING_PAGE_ROUTES
} from '../Coding/shared';

const reactConfig = config('react');

export const DEBOUNCE_DELAY = 1000;

export const ROUTES = Object.freeze({
    NOT_FOUND: '*',
    LOGIN: 'login',
    LOGOUT: 'logout',
    LANDING: '',
    UNAUTHORIZED: 'unauthorized',
    CODING: CODING_ROUTES,
    DATA_COLLECTION: 'data-collection',
    CLEANING: 'cleaning',
    DATA_MODELING: 'modeling',
    WORKSPACE: 'workspaces',
    SETTINGS: 'settings',
    AUTHENTICATED_SETTINGS: 'authenticated-settings'
});

export const LOGGING = false;

// export const USE_LOCAL_SERVER = false;

export const REMOTE_SERVER_BASE_URL = Object.freeze(reactConfig.backendURL);

export const LOGGING_API_URL = Object.freeze(reactConfig.loggingURL);

export const REMOTE_SERVER_ROUTES = Object.freeze(reactConfig.backendRoutes);

export const USE_NEW_FLOW = true;

export const RouteIcons: Record<string, JSX.Element> = {
    [ROUTES.WORKSPACE]: (
        <span className="w-4 h-6 flex items-center justify-center">
            <FaHome size="16px" />
        </span>
    ),
    [ROUTES.SETTINGS]: (
        <span className="w-4 h-6 flex items-center justify-center">
            <FaCog size="16px" />
        </span>
    )
};

export enum TooltipMessages {
    PreviousStep = 'Go back to the previous step',
    NextStep = 'Proceed to the next step',
    Previous = 'Go back to the previous page',
    Next = 'Proceed to the next page',
    SelectAll = 'Select all items',
    DeselectAll = 'Unselect all items',
    RefreshKeywords = 'Let the LLM generate new keywords'
}

export const LOADER_TO_ROUTE_MAP: Record<string, string> = {
    [`/${ROUTES.CODING}/loader/${CODING_LOADER_ROUTES.THEME_LOADER}`]:
        CODING_PAGE_ROUTES.RELATED_CONCEPTS,
    [`/${ROUTES.CODING}/loader/${CODING_LOADER_ROUTES.TORRENT_DATA_LOADER}`]:
        CODING_PAGE_ROUTES.DATASET_CREATION,
    [`/${ROUTES.CODING}/loader/${CODING_LOADER_ROUTES.FINAL_CODING_LOADER}?text=Initial+Coding+in+Progress`]:
        CODING_PAGE_ROUTES.INITIAL_CODING,
    [`/${ROUTES.CODING}/loader/${CODING_LOADER_ROUTES.FINAL_CODING_LOADER}?text=Final+Coding+in+Progress`]:
        CODING_PAGE_ROUTES.FINAL_CODING,
    [`/${ROUTES.CODING}/loader/${CODING_LOADER_ROUTES.FINAL_CODING_LOADER}`]:
        CODING_PAGE_ROUTES.FINAL_CODING,
    [`/${ROUTES.CODING}/loader/${CODING_LOADER_ROUTES.THEME_GENERATION_LOADER}`]:
        CODING_PAGE_ROUTES.GENERATING_THEMES,
    [`/${ROUTES.CODING}/loader/${CODING_LOADER_ROUTES.DATA_LOADING_LOADER}`]:
        CODING_PAGE_ROUTES.DATASET_CREATION,
    [`/${ROUTES.CODING}/loader/${CODING_LOADER_ROUTES.DATA_LOADING_LOADER}?text=Loading+Data`]:
        CODING_PAGE_ROUTES.DATASET_CREATION,
    [`/${ROUTES.CODING}/loader/${CODING_LOADER_ROUTES.DATA_LOADING_LOADER}?text=Reviewing+codes`]:
        CODING_PAGE_ROUTES.REVIEWING_CODES,
    [`/${ROUTES.CODING}/loader/${CODING_LOADER_ROUTES.CODEBOOK_LOADER}`]:
        CODING_PAGE_ROUTES.INITIAL_CODEBOOK,
    [`/${ROUTES.CODING}/loader/${CODING_LOADER_ROUTES.DATA_LOADING_LOADER}?text=Generating+Concept+Outline`]:
        CODING_PAGE_ROUTES.CONCEPT_OUTLINE
};

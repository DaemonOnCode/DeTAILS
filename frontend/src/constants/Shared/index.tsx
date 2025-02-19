import { FaCog, FaHome } from 'react-icons/fa';
import config from '../../config';

const reactConfig = config('react');

export enum ROUTES {
    NOT_FOUND = '*',
    LOGIN = 'login',
    LOGOUT = 'logout',
    LANDING = '',
    UNAUTHORIZED = 'unauthorized',
    CODING = 'coding',
    DATA_COLLECTION = 'data-collection',
    CLEANING = 'cleaning',
    DATA_MODELING = 'modeling',
    WORKSPACE = 'workspaces',
    SETTINGS = 'settings',
    AUTHENTICATED_SETTINGS = 'authenticated-settings'
}

export enum MODEL_LIST {
    LLAMA_3_2 = 'llama3.2:3b',
    LLAMA_3 = 'llama3',
    LLAMA_3_3 = 'llama3.3',
    NU_EXTRACT_1_5 = 'hf.co/DevQuasar/numind.NuExtract-v1.5-GGUF:Q4_K_M',
    DEEPSEEK_R1_32b = 'deepseek-r1:32b',
    DEEPSEEK_R1_70b_fp16 = 'deepseek-r1:70b-llama-distill-fp16',
    GEMINI_FLASH_THINKING = 'gemini-2.0-flash-thinking-exp-01-21',
    GEMINI_FLASH = 'gemini-2.0-flash-001',
    GEMINI = 'gemini-exp-1206'
}

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

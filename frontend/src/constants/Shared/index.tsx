export enum ROUTES {
    NOT_FOUND = '*',
    LOGIN = 'login',
    LOGOUT = 'logout',
    LANDING = '',
    UNAUTHORIZED = 'unauthorized',
    CODING = 'coding',
    DATA_COLLECTION = 'data-collection',
    CLEANING = 'cleaning',
    DATA_MODELING = 'modeling'
}

export const LOGGING_API_URL = 'http://localhost:9000/api/log';

export enum MODEL_LIST {
    LLAMA_3_2 = 'llama3.2:3b',
    LLAMA_3 = 'llama3',
    NU_EXTRACT_1_5 = 'hf.co/DevQuasar/numind.NuExtract-v1.5-GGUF:Q4_K_M'
}

export const LOGGING = true;

export const USE_LOCAL_SERVER = true;

export const REMOTE_SERVER_BASE_URL = 'http://localhost:8080/api';

export enum SERVER_ROUTES {
    PROCESS_DATA = 'process-reddit-data',
}

export const SERVER_ROUTE_MAP: Record<
  SERVER_ROUTES,
  { local: string; server: string }
> = {
  [SERVER_ROUTES.PROCESS_DATA]: {
    local: "local-processing", 
    server: "process-data"
  },
};
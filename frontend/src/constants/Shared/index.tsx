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

export const LOGGING = false;

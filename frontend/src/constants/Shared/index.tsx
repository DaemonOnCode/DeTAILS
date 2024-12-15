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

export const LOGGING_API_URL = 'http://20.51.212.222/logging/api/log';

export enum MODEL_LIST {
    LLAMA_3_2 = 'llama3.2:3b',
    LLAMA_3 = 'llama3',
    NU_EXTRACT_1_5 = 'hf.co/DevQuasar/numind.NuExtract-v1.5-GGUF:Q4_K_M'
}

export const LOGGING = true;

export const USE_LOCAL_SERVER = false;

export const REMOTE_SERVER_BASE_URL = 'http://20.51.212.222/backend/api';

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

export enum REMOTE_SERVER_ROUTES {
    UPLOAD_REDDIT_DATA = "collections/datasets",
    PARSE_REDDIT_DATA = "collections/parse-reddit-dataset",
    GET_REDDIT_POSTS_BY_BATCH = "collections/reddit-posts-by-batch",
    ADD_DOCUMENTS_LANGCHAIN = "coding/add-documents-langchain",
    REGENERATE_FLASHCARDS = "coding/generate-additional-flashcards",
    GENERATE_WORDS = "coding/generate-words",
    REGENERATE_WORDS = "coding/regenerate-words",
    GET_REDDIT_POSTS_TITLES = "collections/reddit-posts-titles",
    GET_REDDIT_POST_BY_ID = "collections/reddit-post-by-id",
    GENERATE_CODES = "coding/generate-codes",
    GENERATE_CODES_WITH_FEEDBACK = "coding/generate-codes-with-feedback",
    FINALIZE_CODES = "coding/finalize-codes",
    ADD_DOCUMENTS_AND_GET_THEMES = "coding/add-documents-and-get-themes",
    GENERATE_THEMES = "coding/generate-themes",
    GENERATE_CODEBOOK = "coding/generate-codebook",
    GENERATE_MORE_CODES = "coding/generate-additional-codes-for-codebook",
    GENERATE_CODES_WITH_THEMES = "coding/generate-codes-with-themes",
    GENERATE_CODES_WITH_THEMES_AND_FEEDBACK = "coding/generate-codes-with-themes-and-feedback",
}

export const USE_NEW_FLOW = true;
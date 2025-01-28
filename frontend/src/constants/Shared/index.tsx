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
    WORKSPACE = 'workspaces'
}

export const LOGGING_API_URL = 'http://20.51.212.222/logging/api/log';

export enum MODEL_LIST {
    LLAMA_3_2 = 'llama3.2:3b',
    LLAMA_3 = 'llama3',
    LLAMA_3_3 = 'llama3.3',
    NU_EXTRACT_1_5 = 'hf.co/DevQuasar/numind.NuExtract-v1.5-GGUF:Q4_K_M'
}

export const LOGGING = false;

// export const USE_LOCAL_SERVER = false;

export const REMOTE_SERVER_BASE_URL = {
    local: 'http://localhost:8080/api',
    remote: 'http://20.51.212.222/backend/api'
};

// export enum SERVER_ROUTES {
//     GET_REDDIT_POSTS_TITLES = '',
//     GET_REDDIT_POST_BY_ID = '',
//     UPLOAD_REDDIT_DATA = '',
//     PARSE_REDDIT_DATA = '',
//     GET_REDDIT_POSTS_BY_BATCH = '',

//     ADD_DOCUMENTS_LANGCHAIN = '',
//     REGENERATE_FLASHCARDS = '',
//     GENERATE_WORDS = '',
//     REGENERATE_WORDS = '',
//     GENERATE_CODES = '',
//     GENERATE_CODES_WITH_FEEDBACK = '',
//     FINALIZE_CODES = '',
//     ADD_DOCUMENTS_AND_GET_THEMES = '',
//     GENERATE_THEMES = '',
//     GENERATE_CODEBOOK = '',
//     GENERATE_MORE_CODES = '',
//     GENERATE_CODES_WITH_THEMES = '',
//     GENERATE_CODES_WITH_THEMES_AND_FEEDBACK = '',

//     CREATE_WORKSPACE = '',
//     GET_WORKSPACES = '',
//     UPDATE_WORKSPACE = '',
//     DELETE_WORKSPACE = '',
//     CREATE_TEMP_WORKSPACE = '',
//     UPGRADE_TEMP_WORKSPACE = '',

//     SAVE_STATE = '',
//     LOAD_STATE = ''
// }

// export enum LOCAL_ROUTES {
//     GET_REDDIT_POSTS_TITLES = '',
//     GET_REDDIT_POST_BY_ID = '',
//     UPLOAD_REDDIT_DATA = '',
//     PARSE_REDDIT_DATA = '',
//     GET_REDDIT_POSTS_BY_BATCH = '',

//     ADD_DOCUMENTS_LANGCHAIN = '',
//     REGENERATE_FLASHCARDS = '',
//     GENERATE_WORDS = '',
//     REGENERATE_WORDS = '',
//     GENERATE_CODES = '',
//     GENERATE_CODES_WITH_FEEDBACK = '',
//     FINALIZE_CODES = '',
//     ADD_DOCUMENTS_AND_GET_THEMES = '',
//     GENERATE_THEMES = '',
//     GENERATE_CODEBOOK = '',
//     GENERATE_MORE_CODES = '',
//     GENERATE_CODES_WITH_THEMES = '',
//     GENERATE_CODES_WITH_THEMES_AND_FEEDBACK = '',

//     CREATE_WORKSPACE = '',
//     GET_WORKSPACES = '',
//     UPDATE_WORKSPACE = '',
//     DELETE_WORKSPACE = '',
//     CREATE_TEMP_WORKSPACE = '',
//     UPGRADE_TEMP_WORKSPACE = '',

//     SAVE_STATE = '',
//     LOAD_STATE = ''
// }
export enum REMOTE_SERVER_ROUTES {
    GET_REDDIT_POSTS_TITLES = 'collections/reddit-posts-titles',
    GET_REDDIT_POST_BY_ID = 'collections/reddit-post-by-id',
    UPLOAD_REDDIT_DATA = 'collections/datasets',
    PARSE_REDDIT_DATA = 'collections/parse-reddit-dataset',
    GET_REDDIT_POSTS_BY_BATCH = 'collections/reddit-posts-by-batch',

    ADD_DOCUMENTS_LANGCHAIN = 'coding/add-documents-langchain',
    REGENERATE_FLASHCARDS = 'coding/generate-additional-flashcards',
    GENERATE_WORDS = 'coding/generate-words',
    REGENERATE_WORDS = 'coding/regenerate-words',
    GENERATE_CODES = 'coding/generate-codes',
    GENERATE_CODES_WITH_FEEDBACK = 'coding/generate-codes-with-feedback',
    FINALIZE_CODES = 'coding/finalize-codes',
    ADD_DOCUMENTS_AND_GET_THEMES = 'coding/add-documents-and-get-themes',
    GENERATE_THEMES = 'coding/generate-themes',
    GENERATE_CODEBOOK = 'coding/generate-codebook',
    GENERATE_MORE_CODES = 'coding/generate-additional-codes-for-codebook',
    GENERATE_CODES_WITH_THEMES = 'coding/generate-codes-with-themes',
    GENERATE_CODES_WITH_THEMES_AND_FEEDBACK = 'coding/generate-codes-with-themes-and-feedback',
    SAMPLE_POSTS = 'coding/sample-posts',

    CREATE_WORKSPACE = 'workspaces/create-workspace',
    GET_WORKSPACES = 'workspaces/get-workspaces',
    UPDATE_WORKSPACE = 'workspaces/update-workspace',
    DELETE_WORKSPACE = 'workspaces/delete-workspace',
    CREATE_TEMP_WORKSPACE = 'workspaces/create-temp-workspace',
    UPGRADE_TEMP_WORKSPACE = 'workspaces/upgrade-workspace-from-temp',

    SAVE_STATE = 'state/save-state',
    LOAD_STATE = 'state/load-state',
    DELETE_STATE = 'state/delete-state',
    IMPORT_WORKSPACE = 'state/import-workspace',
    EXPORT_WORKSPACE = 'state/export-workspace',

    GET_MODEL_METADATA = 'data-modeling/metadata',
    GET_MODEL_SAMPLES = 'data-modeling/samples',
    ADD_MODEL = 'data-modeling/model',
    LIST_MODELS = 'data-modeling/list-models',

    GET_POST_ID_TITLE_BATCH = 'miscellaneous/get-post-title-from-id-batch',
    GET_POST_ID_TITLE = 'miscellaneous/get-post-title-from-id'
}

export const USE_NEW_FLOW = true;

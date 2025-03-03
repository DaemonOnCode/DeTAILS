const config = {
    common: {
        appName: 'DeTAILS',
        miscFrontendURL: {
            local: 'http://localhost:3000',
            remote: 'http://34.130.161.42'
        },
        googleOAuthRedirectPath: '/browser-frontend/oauth-redirect',
        loggingURL: {
            local: 'http://localhost:9000/api/log',
            remote: 'http://34.130.161.42/logging/api/log'
        },
        backendURL: {
            local: 'http://localhost:8080/api',
            remote: 'http://34.130.161.42/backend/api'
        },
        backendRoutes: {
            GET_REDDIT_POSTS_TITLES: 'collections/reddit-posts-titles',
            GET_REDDIT_POST_BY_ID: 'collections/reddit-post-by-id',
            UPLOAD_REDDIT_DATA: 'collections/datasets',
            PARSE_REDDIT_DATA: 'collections/parse-reddit-dataset',
            GET_REDDIT_POSTS_BY_BATCH: 'collections/reddit-posts-by-batch',
            UPLOAD_INTERVIEW_DATA: 'collections/interviews',
            PARSE_INTERVIEW_DATA: 'collections/parse-interview-dataset',
            DOWNLOAD_REDDIT_DATA_FROM_TORRENT: 'collections/download-reddit-data-from-torrent',
            FILTER_POSTS_BY_DELETED: 'collections/filter-posts-by-deleted',
            GET_ALL_TORRENT_DATA: 'collections/get-torrent-data',

            // ADD_DOCUMENTS_LANGCHAIN: 'coding/add-documents-langchain',
            REGENERATE_FLASHCARDS: 'coding/generate-additional-flashcards',
            GENERATE_WORDS: 'coding/generate-words',
            REGENERATE_WORDS: 'coding/regenerate-words',
            GENERATE_CODES: 'coding/generate-codes',
            GENERATE_CODES_WITH_FEEDBACK: 'coding/generate-codes-with-feedback',
            FINALIZE_CODES: 'coding/finalize-codes',
            ADD_DOCUMENTS_AND_GET_THEMES: 'coding/add-documents-and-get-themes',
            GENERATE_THEMES: 'coding/generate-themes',
            GENERATE_CODEBOOK: 'coding/generate-codebook',
            GENERATE_MORE_CODES: 'coding/generate-additional-codes-for-codebook',
            GENERATE_CODES_WITH_THEMES: 'coding/generate-codes-with-themes',
            GENERATE_CODES_WITH_THEMES_AND_FEEDBACK:
                'coding/generate-codes-with-themes-and-feedback',

            SAMPLE_POSTS: 'coding/sample-posts',
            BUILD_CONTEXT: 'coding/build-context-from-topic',
            GENERATE_INITIAL_CODES: 'coding/generate-initial-codes',
            DEDUCTIVE_CODING: 'coding/deductive-coding',
            THEME_GENERATION: 'coding/theme-generation',
            REGENERATE_KEYWORDS: 'coding/regenerate-keywords',
            REFINE_CODEBOOK: 'coding/refine-codebook',
            REFINE_CODE: 'coding/refine-code',

            CREATE_WORKSPACE: 'workspaces/create-workspace',
            GET_WORKSPACES: 'workspaces/get-workspaces',
            UPDATE_WORKSPACE: 'workspaces/update-workspace',
            DELETE_WORKSPACE: 'workspaces/delete-workspace',
            CREATE_TEMP_WORKSPACE: 'workspaces/create-temp-workspace',
            UPGRADE_TEMP_WORKSPACE: 'workspaces/upgrade-workspace-from-temp',

            SAVE_STATE: 'state/save-state',
            LOAD_STATE: 'state/load-state',
            DELETE_STATE: 'state/delete-state',
            IMPORT_WORKSPACE: 'state/import-workspace',
            EXPORT_WORKSPACE: 'state/export-workspace',

            GET_MODEL_METADATA: 'data-modeling/metadata',
            GET_MODEL_SAMPLES: 'data-modeling/samples',
            ADD_MODEL: 'data-modeling/model',
            LIST_MODELS: 'data-modeling/list-models',

            GET_POST_ID_TITLE_BATCH: 'miscellaneous/get-post-title-from-id-batch',
            GET_POST_ID_TITLE: 'miscellaneous/get-post-title-from-id',
            GET_POST_LINK_FROM_ID: 'miscellaneous/get-link-from-post',
            CHECK_TRANSMISSION: 'miscellaneous/check-transmission'
        }
    },
    electron: {},
    react: {}
};

// Function to return only the relevant config
const getConfig = (type) => {
    return {
        ...config.common,
        ...(type === 'electron' ? config.electron : {}),
        ...(type === 'react' ? config.react : {})
    };
};

module.exports = getConfig;

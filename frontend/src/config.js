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
        websocketURL: {
            local: 'http://localhost:8081/api',
            remote: 'http://34.130.161.42/websocket/api'
        },
        backendRoutes: {
            GET_REDDIT_POSTS_TITLES: 'collections/reddit-posts-titles',
            GET_REDDIT_POST_BY_ID: 'collections/reddit-post-by-id',
            UPLOAD_REDDIT_DATA: 'collections/datasets',
            PARSE_REDDIT_DATA: 'collections/parse-reddit-dataset',
            GET_REDDIT_POSTS_BY_BATCH: 'collections/reddit-posts-by-batch',
            UPLOAD_INTERVIEW_DATA: 'collections/datasets',
            PARSE_INTERVIEW_DATA: 'collections/parse-interview-dataset',
            DOWNLOAD_REDDIT_DATA_FROM_TORRENT: 'collections/download-reddit-data-from-torrent',
            FILTER_POSTS_BY_DELETED: 'collections/filter-posts-by-deleted',
            GET_ALL_TORRENT_DATA: 'collections/get-torrent-data',
            PREPARE_REDDIT_TORRENT_DATA_FROM_FILES: 'collections/prepare-torrent-data-from-files',
            GET_TORRENT_STATUS: 'collections/torrent-status',
            CHECK_PRIMARY_TORRENT: 'collections/check-reddit-torrent-availability',
            GET_TRANSCRIPTS_CSV: 'collections/get-transcripts-csv',
            PREPROCESS_INTERVIEW_FILES: 'collections/preprocess-interview-files',
            ANONYMIZE_INTERVIEW_DATA: 'collections/anonymize-interview-data',
            GET_INTERVIEW_DATA: 'collections/get-interview-data',
            GET_INTERVIEW_DATA_BY_ID: 'collections/get-interview-data-by-id',
            GET_INTERVIEW_FILES_BY_BATCH: 'collections/get-interview-files-by-batch',
            SAMPLE_INTERVIEW_FILES: 'collections/sample-interview-files',

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
            REDO_INITIAL_CODING: 'coding/redo-initial-coding',
            REDO_FINAL_CODING: 'coding/remake-final-codes',
            GENERATE_KEYWORD_DEFINITIONS: 'coding/generate-definitions',

            SAMPLE_POSTS: 'coding/sample-posts',
            BUILD_CONTEXT: 'coding/build-context-from-topic',
            GENERATE_INITIAL_CODES: 'coding/generate-initial-codes',
            GENERATE_FINAL_CODES: 'coding/generate-final-codes',
            THEME_GENERATION: 'coding/theme-generation',
            REDO_THEME_GENERATION: 'coding/redo-theme-generation',
            REGENERATE_KEYWORDS: 'coding/regenerate-concepts',
            REFINE_CODEBOOK: 'coding/refine-codebook',
            REFINE_CODE: 'coding/refine-code',
            GROUP_CODES: 'coding/group-codes',
            REGROUP_CODES: 'coding/group-codes',
            GENERATE_CODEBOOK_WITHOUT_QUOTES: 'coding/generate-codebook-without-quotes',
            REGENERATE_CODEBOOK_WITHOUT_QUOTES: 'coding/regenerate-codebook-without-quotes',
            GENERATE_DEDUCTIVE_CODES: 'coding/generate-deductive-codes',
            GET_PAGINATED_RESPONSES: 'coding/paginated-responses',
            GET_PAGINATED_POST_TITLES: 'coding/paginated-posts',
            GET_PAGINATED_POSTS_METADATA: 'coding/paginated-posts-metadata',
            GET_PAGINATED_CODES: 'coding/paginated-codes',
            GET_POST_TRANSCRIPT_DATA: 'coding/transcript-data',
            GET_ANALYSIS_REPORT: 'coding/analysis-report',
            DOWNLOAD_ANALYSIS_REPORT: 'coding/analysis-download',
            DOWNLOAD_CODES: 'coding/download-codes',

            CREATE_WORKSPACE: 'workspaces/create-workspace',
            GET_WORKSPACES: 'workspaces/get-workspaces',
            UPDATE_WORKSPACE: 'workspaces/update-workspace',
            DELETE_WORKSPACE: 'workspaces/delete-workspace',
            CREATE_TEMP_WORKSPACE: 'workspaces/create-temp-workspace',
            UPGRADE_TEMP_WORKSPACE: 'workspaces/upgrade-workspace-from-temp',

            SAVE_STATE: 'state/save-state',
            LOAD_STATE: 'state/load-state',
            DELETE_STATE: 'state/delete-state',
            RESTORE_LAST_SAVED: 'state/restore-last-saved',

            SAVE_CODING_CONTEXT: 'state/save-coding-context',
            LOAD_CODING_CONTEXT: 'state/load-coding-context',
            SAVE_COLLECTION_CONTEXT: 'state/save-collection-context',
            LOAD_COLLECTION_CONTEXT: 'state/load-collection-context',

            RESET_CONTEXT_DATA: 'state/reset-context-data',
            CHECK_CONTEXT_DATA_EXISTS: 'state/check-data-existence',
            DOWNLOAD_CONTEXT_DATA: 'state/download-context-data',

            GET_MODEL_METADATA: 'data-modeling/metadata',
            GET_MODEL_SAMPLES: 'data-modeling/samples',
            ADD_MODEL: 'data-modeling/model',
            LIST_MODELS: 'data-modeling/list-models',

            GET_POST_ID_TITLE_BATCH: 'miscellaneous/get-post-title-from-id-batch',
            GET_POST_ID_TITLE: 'miscellaneous/get-post-title-from-id',
            GET_POST_LINK_FROM_ID: 'miscellaneous/get-link-from-post',
            CHECK_TRANSMISSION: 'miscellaneous/check-transmission',
            CHECK_CREDENTIALS: 'miscellaneous/test-user-credentials',
            CHECK_MODEL: 'miscellaneous/test-model',
            CHECK_EMBEDDING: 'miscellaneous/test-embedding',
            CHECK_FUNCTION_PROGRESS: 'miscellaneous/get-function-progress',

            OLLAMA_PULL: 'ollama/pull-model',
            OLLAMA_DELETE: 'ollama/delete-model',
            OLLAMA_LIST: 'ollama/list-models',
            OLLAMA_MODEL_METADATA: 'ollama/model-metadata'
        }
    },
    electron: {},
    react: {}
};

const getConfig = (type) => {
    return {
        ...config.common,
        ...(type === 'electron' ? config.electron : {}),
        ...(type === 'react' ? config.react : {})
    };
};

module.exports = getConfig;

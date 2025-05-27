export const CODING_ROUTES = 'code';

export enum ROUTES {
    HOME = 'home',
    BACKGROUND_RESEARCH = 'background-research',
    CODEBOOK_CREATION = 'initial-coding',
    FINAL_CODING = 'final-coding',
    LLM_CONTEXT = 'context',
    RELATED_CONCEPTS = 'related-concepts',
    CONCEPT_OUTLINE = 'concept-outline',
    LOAD_DATA = 'loading-data',
    DATA_TYPE = 'data-type',
    DATA_SOURCE = 'data-source',
    DATASET_CREATION = 'dataset-creation',
    CODES_REVIEW = 'codes-review',
    CODEBOOK_REFINEMENT = 'codebook-refinement',
    THEMES = 'generating-themes',
    ANALYSIS = 'report',
    TRANSCRIPT = 'transcript/:id/:state',
    TRANSCRIPTS = 'transcripts',
    FINALIZING_CODES = 'reviewing-codes',
    INITIAL_CODEBOOK = 'initial-codebook',
    INITIAL_CODING_CODEBOOK = 'coding'
}

export const PAGE_ROUTES = Object.freeze({
    HOME: `/${CODING_ROUTES}/${ROUTES.HOME}`,
    TRANSCRIPTS: `/${CODING_ROUTES}/${ROUTES.TRANSCRIPTS}`,
    TRANSCRIPT: `/${CODING_ROUTES}/${ROUTES.TRANSCRIPT}`,

    // Nested routes under BACKGROUND_RESEARCH
    CONTEXT: `/${CODING_ROUTES}/${ROUTES.BACKGROUND_RESEARCH}/${ROUTES.LLM_CONTEXT}`,
    RELATED_CONCEPTS: `/${CODING_ROUTES}/${ROUTES.BACKGROUND_RESEARCH}/${ROUTES.RELATED_CONCEPTS}`,
    CONCEPT_OUTLINE: `/${CODING_ROUTES}/${ROUTES.BACKGROUND_RESEARCH}/${ROUTES.CONCEPT_OUTLINE}`,

    // Nested routes under LOAD_DATA
    DATA_TYPE: `/${CODING_ROUTES}/${ROUTES.LOAD_DATA}/${ROUTES.DATA_TYPE}`,
    DATA_SOURCE: `/${CODING_ROUTES}/${ROUTES.LOAD_DATA}/${ROUTES.DATA_SOURCE}`,
    DATASET_CREATION: `/${CODING_ROUTES}/${ROUTES.LOAD_DATA}/${ROUTES.DATASET_CREATION}`,

    // Nested routes under CODING
    INITIAL_CODING: `/${CODING_ROUTES}/${ROUTES.INITIAL_CODING_CODEBOOK}/${ROUTES.CODEBOOK_CREATION}`,
    INITIAL_CODEBOOK: `/${CODING_ROUTES}/${ROUTES.INITIAL_CODING_CODEBOOK}/${ROUTES.INITIAL_CODEBOOK}`,
    FINAL_CODING: `/${CODING_ROUTES}/${ROUTES.INITIAL_CODING_CODEBOOK}/${ROUTES.FINAL_CODING}`,

    REVIEWING_CODES: `/${CODING_ROUTES}/${ROUTES.FINALIZING_CODES}`,

    GENERATING_THEMES: `/${CODING_ROUTES}/${ROUTES.THEMES}`,

    REPORT: `/${CODING_ROUTES}/${ROUTES.ANALYSIS}`
});

export enum LOADER_ROUTES {
    CODEBOOK_LOADER = 'codebook-loader',
    CODING_VALIDATION_LOADER = 'coding-validation-loader',
    FINAL_LOADER = 'final-loader',
    THEME_LOADER = 'theme-loader',
    CONCEPT_OUTLINE_LOADER = 'concept-table-loader',
    FINAL_CODING_LOADER = 'final-coding-loader',
    THEME_GENERATION_LOADER = 'theme-generation-loader',
    DETAILS_LOADER = 'details-loader',
    DATA_LOADING_LOADER = 'data-loading-loader',
    TORRENT_DATA_LOADER = 'torrent-data-loader',
    REDDIT_DATA_LOADER = 'reddit-data-loader'
}

export const WORD_CLOUD_MIN_THRESHOLD = 1;

export const FLASHCARDS_MIN_THRESHOLD = 10;

export const SELECTED_POSTS_MIN_THRESHOLD = 3;

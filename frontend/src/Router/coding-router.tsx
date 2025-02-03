import { RouteObject } from 'react-router-dom';
import HomePage from '../pages/Coding/home';
import {
    CodeBookLoaderPage,
    CodingValidationLoaderPage,
    DeductiveCodingLoaderPage,
    FinalLoaderPage,
    FlashcardsLoaderPage,
    ThemeGenerationLoaderPage,
    ThemeLoaderPage,
    WordCloudLoaderPage
} from '../pages/Coding/Loader';
import {
    ContextV2Page,
    KeywordTablePage,
    FinalPage,
    KeywordCloudPage,
    CodeReviewPage,
    CodebookRefinementPage,
    TranscriptPage,
    ThemesPage,
    FinalCodebookPage,
    CodeValidationPage,
    SplitCheckPage,
    EncodedDataPage,
    TranscriptsPage,
    LoadDataPage
} from '../pages/Coding';

import { LOADER_ROUTES, ROUTES } from '../constants/Coding/shared';

export const CodingRouter: RouteObject[] = [
    { path: ROUTES.HOME, element: <HomePage />, index: true },
    { path: ROUTES.CONTEXT_V2, element: <ContextV2Page /> },
    { path: ROUTES.KEYWORD_CLOUD, element: <KeywordCloudPage /> },
    { path: ROUTES.KEYWORD_TABLE, element: <KeywordTablePage /> },
    {
        path: ROUTES.LOAD_DATA,
        element: <LoadDataPage />
    },
    {
        path: ROUTES.CODES_REVIEW,
        element: <CodeReviewPage />
    },
    {
        path: ROUTES.CODEBOOK_REFINEMENT,
        element: <CodebookRefinementPage />
    },

    {
        path: ROUTES.TRANSCRIPT,
        element: <TranscriptPage />
    },
    {
        path: ROUTES.FINAL_CODEBOOK,
        element: <FinalCodebookPage />
    },
    // {
    //     path: ROUTES.CODE_VALIDATION,
    //     element: <CodeValidationPage />
    // },
    {
        path: ROUTES.SPLIT_CHECK,
        element: <SplitCheckPage />
    },
    {
        path: ROUTES.ENCODED_DATA,
        element: <EncodedDataPage />
    },
    {
        path: ROUTES.THEMES,
        element: <ThemesPage />
    },
    {
        path: ROUTES.TRANSCRIPTS,
        element: <TranscriptsPage />
    },
    { path: ROUTES.FINAL, element: <FinalPage /> },
    {
        path: 'loader',
        children: [
            {
                path: LOADER_ROUTES.FLASHCARDS_LOADER,
                element: <FlashcardsLoaderPage />
            },
            {
                path: LOADER_ROUTES.THEME_LOADER,
                element: <ThemeLoaderPage />
            },
            {
                path: LOADER_ROUTES.WORD_CLOUD_LOADER,
                element: <WordCloudLoaderPage />
            },
            {
                path: LOADER_ROUTES.CODEBOOK_LOADER,
                element: <CodeBookLoaderPage />
            },
            {
                path: LOADER_ROUTES.CODING_VALIDATION_LOADER,
                element: <CodingValidationLoaderPage />
            },
            {
                path: LOADER_ROUTES.FINAL_LOADER,
                element: <FinalLoaderPage />
            },
            {
                path: LOADER_ROUTES.DEDUCTIVE_CODING_LOADER,
                element: <DeductiveCodingLoaderPage />
            },
            {
                path: LOADER_ROUTES.THEME_GENERATION_LOADER,
                element: <ThemeGenerationLoaderPage />
            }
        ]
    }
];

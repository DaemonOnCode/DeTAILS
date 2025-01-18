import { RouteObject } from 'react-router-dom';
import HomePage from '../pages/Coding/home';
import BasisPage from '../pages/Coding/basis';
import FlashcardsPage from '../pages/Coding/flashcards';
import {
    CodeBookLoaderPage,
    CodingValidationLoaderPage,
    FinalLoaderPage,
    FlashcardsLoaderPage,
    ThemeLoaderPage,
    WordCloudLoaderPage
} from '../pages/Coding/Loader';
import {
    ContextV2Page,
    CodeBookPage,
    CodingOverviewPage,
    CodingValidationPage,
    CodingValidationV2Page,
    FinalPage,
    InitialCodingPage,
    ThemeCloudPage,
    WordCloudPage
} from '../pages/Coding';

import { LOADER_ROUTES, ROUTES } from '../constants/Coding/shared';

export const CodingRouter: RouteObject[] = [
    { path: ROUTES.HOME, element: <HomePage />, index: true },
    { path: ROUTES.BASIS, element: <BasisPage /> },
    { path: ROUTES.CONTEXT_V2, element: <ContextV2Page /> },
    { path: ROUTES.FLASHCARDS, element: <FlashcardsPage /> },
    { path: ROUTES.THEME_CLOUD, element: <ThemeCloudPage /> },
    { path: ROUTES.WORD_CLOUD, element: <WordCloudPage /> },
    { path: ROUTES.CODEBOOK, element: <CodeBookPage /> },
    { path: ROUTES.INITIAL_CODING, element: <InitialCodingPage /> },
    { path: ROUTES.CODING_VALIDATION, element: <CodingValidationPage /> },
    { path: ROUTES.CODING_VALIDATION_V2, element: <CodingValidationV2Page /> },
    { path: ROUTES.CODING_OVERVIEW, element: <CodingOverviewPage /> },
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
            }
        ]
    }
];

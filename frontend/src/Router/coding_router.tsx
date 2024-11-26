import { RouteObject } from 'react-router-dom';
import HomePage from '../pages/Coding/home';
import BasisPage from '../pages/Coding/basis';
import FlashcardsPage from '../pages/Coding/flashcards';
import {
    CodingValidationLoaderPage,
    FinalLoaderPage,
    FlashcardsLoaderPage,
    WordCloudLoaderPage
} from '../pages/Coding/Loader';
import { CodingValidationPage, FinalPage, InitialCodingPage, WordCloudPage } from '../pages/Coding';

import { LOADER_ROUTES, ROUTES } from '../constants/Coding/shared';

export const CodingRouter: RouteObject[] = [
    { path: ROUTES.HOME, element: <HomePage />, index: true },
    { path: ROUTES.BASIS, element: <BasisPage /> },
    { path: ROUTES.FLASHCARDS, element: <FlashcardsPage /> },
    { path: ROUTES.WORD_CLOUD, element: <WordCloudPage /> },
    { path: ROUTES.INITIAL_CODING, element: <InitialCodingPage /> },
    { path: ROUTES.CODING_VALIDATION, element: <CodingValidationPage /> },
    { path: ROUTES.FINAL, element: <FinalPage /> },
    {
        path: 'loader',
        children: [
            {
                path: LOADER_ROUTES.FLASHCARDS_LOADER,
                element: <FlashcardsLoaderPage />
            },
            {
                path: LOADER_ROUTES.WORD_CLOUD_LOADER,
                element: <WordCloudLoaderPage />
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

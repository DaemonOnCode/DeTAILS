import { RouteObject } from 'react-router-dom';
import HomePage from '../pages/Coding/home';
import {
    CodeBookLoaderPage,
    DataLoadingLoaderPage,
    FinalCodingLoaderPage,
    ThemeGenerationLoaderPage,
    ThemeLoaderPage,
    TorrentLoaderPage,
    RedditDataLoaderPage
} from '../pages/Coding/Loader';
import {
    TranscriptPage,
    ThemesPage,
    FinalizingCodesPage,
    InitialCodeBookPage,
    ContextPage,
    ConceptOutlinePage,
    FinalCodingPage,
    InitialCodingPage,
    RelevantConceptsPage,
    ReportPage
} from '../pages/Coding';
import {
    HomePage as CollectionHomePage,
    DataSourcePage,
    DatasetCreationPage
} from '../pages/DataCollection';

import { LOADER_ROUTES, ROUTES } from '../constants/Coding/shared';

export const CodingRouter: RouteObject[] = [
    { path: ROUTES.HOME, element: <HomePage />, index: true },
    {
        path: ROUTES.BACKGROUND_RESEARCH,
        children: [
            { path: ROUTES.LLM_CONTEXT, element: <ContextPage />, index: true },
            { path: ROUTES.RELATED_CONCEPTS, element: <RelevantConceptsPage /> },
            { path: ROUTES.CONCEPT_OUTLINE, element: <ConceptOutlinePage /> }
        ]
    },
    {
        path: ROUTES.LOAD_DATA,
        children: [
            { path: ROUTES.DATA_TYPE, element: <CollectionHomePage />, index: true },
            {
                path: ROUTES.DATA_SOURCE,
                element: <DataSourcePage />
            },
            {
                path: ROUTES.DATASET_CREATION,
                element: <DatasetCreationPage />
            }
        ]
    },
    {
        path: ROUTES.INITIAL_CODING_CODEBOOK,
        children: [
            {
                path: ROUTES.CODEBOOK_CREATION,
                element: <InitialCodingPage />,
                index: true
            },
            {
                path: ROUTES.INITIAL_CODEBOOK,
                element: <InitialCodeBookPage />
            },
            {
                path: ROUTES.FINAL_CODING,
                element: <FinalCodingPage />
            }
        ]
    },

    {
        path: ROUTES.TRANSCRIPT,
        element: <TranscriptPage />
    },
    {
        path: ROUTES.FINALIZING_CODES,
        element: <FinalizingCodesPage />
    },
    {
        path: ROUTES.THEMES,
        element: <ThemesPage />
    },
    { path: ROUTES.ANALYSIS, element: <ReportPage /> },
    {
        path: 'loader',
        children: [
            {
                path: LOADER_ROUTES.THEME_LOADER,
                element: <ThemeLoaderPage />
            },
            {
                path: LOADER_ROUTES.CODEBOOK_LOADER,
                element: <CodeBookLoaderPage />
            },
            {
                path: LOADER_ROUTES.FINAL_CODING_LOADER,
                element: <FinalCodingLoaderPage />
            },
            {
                path: LOADER_ROUTES.THEME_GENERATION_LOADER,
                element: <ThemeGenerationLoaderPage />
            },
            {
                path: LOADER_ROUTES.DATA_LOADING_LOADER,
                element: <DataLoadingLoaderPage />
            },
            {
                path: LOADER_ROUTES.TORRENT_DATA_LOADER,
                element: <TorrentLoaderPage />
            },
            {
                path: LOADER_ROUTES.REDDIT_DATA_LOADER,
                element: <RedditDataLoaderPage />
            }
        ]
    }
];

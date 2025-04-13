import { RouteObject } from 'react-router-dom';
import HomePage from '../pages/Coding/home';
import {
    CodeBookLoaderPage,
    CodingValidationLoaderPage,
    DataLoadingLoaderPage,
    DeductiveCodingLoaderPage,
    FinalLoaderPage,
    FlashcardsLoaderPage,
    ThemeGenerationLoaderPage,
    ThemeLoaderPage,
    TorrentLoaderPage,
    WordCloudLoaderPage
} from '../pages/Coding/Loader';
import {
    ContextV2Page,
    KeywordTablePage,
    KeywordCloudPage,
    TranscriptPage,
    ThemesPage,
    SplitCheckPage,
    EncodedDataPage,
    TranscriptsPage,
    LoadDataPage,
    AnalysisPage,
    CodebookCreationPage,
    ManualCodingPage,
    DeductiveCodingPage,
    FinalizingCodesPage,
    InitialCodeBookPage
} from '../pages/Coding';
import { ROUTES as COLLECTION_ROUTES } from '../constants/DataCollection/shared';
import {
    HomePage as CollectionHomePage,
    DataViewerPage,
    UploadDataPage
} from '../pages/DataCollection';

import { LOADER_ROUTES, ROUTES } from '../constants/Coding/shared';

export const CodingRouter: RouteObject[] = [
    { path: ROUTES.HOME, element: <HomePage />, index: true },
    {
        path: ROUTES.BACKGROUND_RESEARCH,
        children: [
            { path: ROUTES.LLM_CONTEXT_V2, element: <ContextV2Page />, index: true },
            { path: ROUTES.KEYWORD_CLOUD, element: <KeywordCloudPage /> },
            { path: ROUTES.KEYWORD_TABLE, element: <KeywordTablePage /> }
        ]
    },
    {
        path: ROUTES.LOAD_DATA,
        children: [
            { path: ROUTES.DATA_SOURCE, element: <CollectionHomePage />, index: true },
            {
                path: ROUTES.DATASET_CREATION,
                element: <UploadDataPage />
            },
            {
                path: ROUTES.DATA_VIEWER,
                element: <DataViewerPage />
            },
            {
                path: ROUTES.TRANSCRIPTS,
                element: <TranscriptsPage />
            }
        ]
        // element: <LoadDataPage />
    },
    {
        path: ROUTES.INITIAL_CODING_CODEBOOK,
        children: [
            {
                path: ROUTES.CODEBOOK_CREATION,
                element: <CodebookCreationPage />,
                index: true
                // children: [
                //     {
                //         path: ROUTES.CODES_REVIEW,
                //         element: <CodeReviewPage />,
                //         index: true
                //     },
                //     {
                //         path: ROUTES.CODEBOOK_REFINEMENT,
                //         element: <CodebookRefinementPage />
                //     },
                //     {
                //         path: ROUTES.FINAL_CODEBOOK,
                //         element: <FinalCodebookPage />
                //     }
                // ]
            },
            {
                path: ROUTES.INITIAL_CODEBOOK,
                element: <InitialCodeBookPage />
            },
            {
                path: ROUTES.DEDUCTIVE_CODING,
                element: <DeductiveCodingPage />
                // children: [
                //     {
                //         path: ROUTES.SPLIT_CHECK,
                //         element: <SplitCheckPage />,
                //         index: true
                //     },
                //     {
                //         path: ROUTES.ENCODED_DATA,
                //         element: <EncodedDataPage />
                //     }
                // ]
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
        // index: true,
        path: ROUTES.THEMES,
        element: <ThemesPage />
    },
    { path: ROUTES.ANALYSIS, element: <AnalysisPage /> },
    // {
    //     path: ROUTES.THEMATIC_ANALYSIS,
    //     children: [
    //     ]
    // },
    {
        path: ROUTES.TRANSCRIPTS,
        element: <TranscriptsPage />
    },
    {
        path: ROUTES.MANUAL_CODING,
        element: <ManualCodingPage />
    },
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
            },
            {
                path: LOADER_ROUTES.DATA_LOADING_LOADER,
                element: <DataLoadingLoaderPage />
            },
            {
                path: LOADER_ROUTES.TORRENT_DATA_LOADER,
                element: <TorrentLoaderPage />
            }
        ]
    }
];

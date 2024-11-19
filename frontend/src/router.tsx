import { FC } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import HomePage from './pages/home';
import NotFoundPage from './pages/not_found';
import BasisPage from './pages/basis';
import WordCloudPage from './pages/word_cloud';
import { LOADER_ROUTES, ROUTES } from './constants/shared';
import GenerationPage from './pages/generation';
import CodingValidationPage from './pages/coding_validation';
import FinalPage from './pages/final';
import InitialCodingPage from './pages/initial_coding';
import FlashcardsPage from './pages/flashcards';
import FlashcardsLoaderPage from './pages/Loader/flashcards_loader';

export const Router: FC = () => {
    return (
        <HashRouter>
            <Routes>
                <Route path={ROUTES.HOME.substring(1)} element={<HomePage />} />
                <Route path={ROUTES.BASIS.substring(1)} element={<BasisPage />} />
                <Route path={ROUTES.FLASHCARDS.substring(1)} element={<FlashcardsPage />} />
                <Route
                    path={LOADER_ROUTES.FLASHCARDS_LOADER.substring(1)}
                    element={<FlashcardsLoaderPage />}
                />
                <Route path={ROUTES.WORD_CLOUD.substring(1)} element={<WordCloudPage />} />
                <Route path={ROUTES.INITIAL_CODING.substring(1)} element={<InitialCodingPage />} />
                <Route path={ROUTES.GENERATION.substring(1)} element={<GenerationPage />} />
                <Route
                    path={ROUTES.CODING_VALIDATION.substring(1)}
                    element={<CodingValidationPage />}
                />
                <Route path={ROUTES.FINAL.substring(1)} element={<FinalPage />} />
                <Route path={ROUTES.NOT_FOUND} element={<NotFoundPage />} />
            </Routes>
        </HashRouter>
    );
};

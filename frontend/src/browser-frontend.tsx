import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import OAuthRedirectPage from './pages/Shared/oauth-redirect';
const BrowserFrontend: React.FC = () => {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/browser-frontend/oauth-redirect" element={<OAuthRedirectPage />} />
            </Routes>
        </BrowserRouter>
    );
};

export default BrowserFrontend;

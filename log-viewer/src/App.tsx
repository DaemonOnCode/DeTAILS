import { BrowserRouter, HashRouter, Routes, Route } from 'react-router-dom';
import OAuthRedirect from './pages/OAuthRedirect';
import LogViewer from './pages/LogViewer';

function App() {
    const Router = process.env.REACT_APP_ROUTER === 'hash' ? HashRouter : BrowserRouter;

    return (
        <Router basename="/misc-frontend">
            <Routes>
                <Route path="/oauth-redirect" element={<OAuthRedirect />} />
                <Route path="/log-viewer" element={<LogViewer />} />
            </Routes>
        </Router>
    );
}

export default App;

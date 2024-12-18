import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import OAuthRedirect from './pages/OAuthRedirect';
import LogViewer from './pages/LogViewer';

function App() {
    return (
        <Router basename="/pages">
            <Routes>
                <Route path="/oauth-redirect" element={<OAuthRedirect />} />
                <Route path="/log-viewer" element={<LogViewer />} />
            </Routes>
        </Router>
    );
}

export default App;

import React from 'react';
import { HashRouter } from 'react-router-dom';
import { AuthProvider } from './context/auth-context';
import { LoggingProvider } from './context/logging-context';
import SystemMetricsLogger from './components/Shared/system-metrics-logger';
import { ToastContainer } from 'react-toastify';
import { ApplicationRouter } from './router';
import ErrorBoundary from './pages/Shared/error';

const ElectronFrontend: React.FC = () => {
    return (
        // <HashRouter>
        // <ErrorBoundary>
        <LoggingProvider>
            <AuthProvider>
                <ToastContainer />
                <SystemMetricsLogger />
                <ApplicationRouter />
            </AuthProvider>
        </LoggingProvider>
        // </ErrorBoundary>
        // </HashRouter>
    );
};

export default ElectronFrontend;

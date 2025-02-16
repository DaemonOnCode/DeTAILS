import React from 'react';
import { HashRouter } from 'react-router-dom';
import { AuthProvider } from './context/auth-context';
import { LoggingProvider } from './context/logging-context';
import SystemMetricsLogger from './components/Shared/system-metrics-logger';
import { ToastContainer } from 'react-toastify';
import ErrorPage from './pages/Shared/error';
import { ApplicationRouter } from './router';

const ElectronFrontend: React.FC = () => {
    return (
        <HashRouter>
            <ErrorPage>
                <LoggingProvider>
                    <AuthProvider>
                        <ToastContainer />
                        <SystemMetricsLogger />
                        <ApplicationRouter />
                    </AuthProvider>
                </LoggingProvider>
            </ErrorPage>
        </HashRouter>
    );
};

export default ElectronFrontend;

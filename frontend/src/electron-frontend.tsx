import React from 'react';
import { AuthProvider } from './context/auth-context';
import { LoggingProvider } from './context/logging-context';
import SystemMetricsLogger from './components/Shared/system-metrics-logger';
import { ToastContainer } from 'react-toastify';
import { ApplicationRouter } from './router';
import { SettingsProvider } from './context/settings-context';

const ElectronFrontend: React.FC = () => {
    return (
        // <HashRouter>
        // <ErrorBoundary>
        <SettingsProvider>
            <LoggingProvider>
                <AuthProvider>
                    <ToastContainer />
                    <SystemMetricsLogger />
                    <ApplicationRouter />
                </AuthProvider>
            </LoggingProvider>
        </SettingsProvider>
        // </ErrorBoundary>
        // </HashRouter>
    );
};

export default ElectronFrontend;

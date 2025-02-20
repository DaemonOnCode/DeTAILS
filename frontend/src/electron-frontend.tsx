import React from 'react';
import { AuthProvider } from './context/auth-context';
import { LoggingProvider } from './context/logging-context';
import SystemMetricsLogger from './components/Shared/system-metrics-logger';
import { ToastContainer } from 'react-toastify';
import { ApplicationRouter } from './router';
import { SettingsProvider } from './context/settings-context';
import { ToastProvider } from './context/toast-context';

const ElectronFrontend: React.FC = () => {
    return (
        // <HashRouter>
        // <ErrorBoundary>
        <ToastProvider>
            <SettingsProvider>
                <LoggingProvider>
                    <AuthProvider>
                        <ToastContainer stacked limit={3} newestOnTop />
                        <SystemMetricsLogger />
                        <ApplicationRouter />
                    </AuthProvider>
                </LoggingProvider>
            </SettingsProvider>
        </ToastProvider>
        // </ErrorBoundary>
        // </HashRouter>
    );
};

export default ElectronFrontend;

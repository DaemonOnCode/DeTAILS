import React from 'react';
import ReactDOM from 'react-dom/client';

import './styles/index.css';
import './styles/tailwind.css';
import 'react-toastify/dist/ReactToastify.css';

import { ApplicationRouter } from './router';
import { HashRouter } from 'react-router-dom';
import { AuthProvider } from './context/auth-context';
import { LoggingProvider } from './context/logging-context';
import SystemMetricsLogger from './components/Shared/system-metrics-logger';
import { ToastContainer } from 'react-toastify';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
    <React.StrictMode>
        <HashRouter>
            <LoggingProvider>
                <AuthProvider>
                    <ToastContainer />
                    <SystemMetricsLogger />
                    <ApplicationRouter />
                </AuthProvider>
            </LoggingProvider>
        </HashRouter>
    </React.StrictMode>
);

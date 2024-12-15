import React from 'react';
import ReactDOM from 'react-dom/client';

import './styles/index.css';
import './styles/tailwind.css';
import "react-toastify/dist/ReactToastify.css";

import { ApplicationRouter } from './router';
import { HashRouter } from 'react-router-dom';
import { AuthProvider } from './context/auth_context';
import { LoggingProvider } from './context/logging_context';
import SystemMetricsLogger from './components/Shared/system_metrics_logger';
import { WebSocketProvider } from './context/websocket_context';
import { ToastContainer } from 'react-toastify';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
    <React.StrictMode>
        <HashRouter>
            <LoggingProvider>
                <AuthProvider>
                    <WebSocketProvider>
                        <ToastContainer />
                        <SystemMetricsLogger />
                        <ApplicationRouter />
                    </WebSocketProvider>
                </AuthProvider>
            </LoggingProvider>
        </HashRouter>
    </React.StrictMode>
);

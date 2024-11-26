import React from 'react';
import ReactDOM from 'react-dom/client';

import './styles/index.css';
import './styles/tailwind.css';

import { ApplicationRouter } from './router';
import { HashRouter } from 'react-router-dom';
import { AuthProvider } from './context/auth_context';
import { LoggingProvider } from './context/logging_context';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
    <React.StrictMode>
        <HashRouter>
            <AuthProvider>
                <LoggingProvider>
                    <ApplicationRouter />
                </LoggingProvider>
            </AuthProvider>
        </HashRouter>
    </React.StrictMode>
);

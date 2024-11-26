import React from 'react';
import ReactDOM from 'react-dom/client';

import './styles/index.css';
import './styles/tailwind.css';

import { ApplicationRouter } from './Router';
import { DataProvider } from './context/data_context';
import { Layout } from './components/Shared/layout';
import { HashRouter } from 'react-router-dom';
import { AuthProvider } from './context/auth_context';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
    <React.StrictMode>
        <HashRouter>
            <AuthProvider>
                <DataProvider>
                    <Layout>
                        <ApplicationRouter />
                    </Layout>
                </DataProvider>
            </AuthProvider>
        </HashRouter>
    </React.StrictMode>
);

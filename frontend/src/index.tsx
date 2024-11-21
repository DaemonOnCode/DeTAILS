import React from 'react';
import ReactDOM from 'react-dom/client';

import './styles/index.css';
import './styles/tailwind.css';

import { Router } from './router';
import { DataProvider } from './context/data_context';
import { Layout } from './components/Shared/layout';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
    <React.StrictMode>
        <DataProvider>
            <Layout>
                <Router />
            </Layout>
        </DataProvider>
    </React.StrictMode>
);

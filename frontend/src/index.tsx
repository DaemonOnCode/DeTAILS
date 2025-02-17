import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';

import './styles/index.css';
import './styles/tailwind.css';
import 'react-toastify/dist/ReactToastify.css';

import BrowserFrontend from './browser-frontend';

const ElectronFrontend = lazy(() => import('./electron-frontend'));

const isBrowser = window.location.pathname.startsWith('/browser-frontend');

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
    <React.StrictMode>
        {isBrowser ? (
            <BrowserFrontend />
        ) : (
            <Suspense fallback={<></>}>
                <ElectronFrontend />
            </Suspense>
        )}
    </React.StrictMode>
);

import React from 'react';
import { RouteObject } from 'react-router-dom';
import { ProtectedRoute } from '../components/Shared/protected_route';
import { DataProvider } from '../context/data_context';
import { Layout } from '../components/Shared/layout';

export const protectRoutes = (routes: RouteObject[]): RouteObject[] => [
    {
        element: (
            <DataProvider>
                <Layout>
                    <ProtectedRoute />
                </Layout>
            </DataProvider>
        ),
        children: routes
    }
];

import { FC } from 'react';
import { RouteObject, RouterProvider, createHashRouter } from 'react-router-dom';
import { protectRoutes } from '../utility/protect-routes';
import { ROUTES } from '../constants/Shared';
import { SharedRouter } from './shared-router';
import { CodingRouter } from './coding-router';
import { DataCollectionRouter } from './data-collection-router';
import { DataModelingRouter } from './data-modeling-router';
import { DataCleaningRouter } from './data-cleaning-router';
import { WorkspaceSelectionPage } from '../pages/Workspaces';
import { Layout } from '../components/Shared/layout';
import { ProtectedRoute } from '../components/Shared/protected-route';
import { DataProvider } from '../context/data-context';
import { WebSocketProvider } from '../context/websocket-context';
import { WorkspaceProvider } from '../context/workspace-context';
import { WorkspaceProtectedRoute } from '../components/Shared/workpace-protected-routes';
import { SettingsPage } from '../pages/Settings';
import { ErrorBoundary } from '../pages/Shared/error-boundary';

export const AppRoutes: RouteObject[] = [
    {
        path: '/',
        children: SharedRouter
    },
    {
        children: protectRoutes(
            [
                {
                    path: ROUTES.WORKSPACE,
                    element: <WorkspaceSelectionPage />
                },
                {
                    children: protectRoutes(
                        [
                            {
                                path: ROUTES.DATA_COLLECTION,
                                children: DataCollectionRouter
                            },
                            {
                                path: ROUTES.CLEANING,
                                children: DataCleaningRouter
                            },
                            {
                                path: ROUTES.DATA_MODELING,
                                children: DataModelingRouter
                            },
                            {
                                path: ROUTES.CODING,
                                children: CodingRouter
                            }
                        ],
                        <WorkspaceProtectedRoute />
                    )
                },
                {
                    path: ROUTES.AUTHENTICATED_SETTINGS,
                    element: <SettingsPage authenticated />
                }
            ],

            <WebSocketProvider>
                <WorkspaceProvider>
                    <DataProvider>
                        <Layout>
                            <ProtectedRoute />
                        </Layout>
                    </DataProvider>
                </WorkspaceProvider>
            </WebSocketProvider>
        ),
        errorElement: <ErrorBoundary />
    }
];

export const ApplicationRouter: FC = () => {
    const router = createHashRouter(AppRoutes);
    return <RouterProvider router={router} />;
};

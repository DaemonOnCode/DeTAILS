import { RouteObject } from 'react-router-dom';
import { ProtectedRoute } from '../components/Shared/protected_route';
import { DataProvider } from '../context/data_context';
import { Layout } from '../components/Shared/layout';
import { WorkspaceProvider } from '../context/workspace_context';

export const protectRoutes = (routes: RouteObject[]): RouteObject[] => [
    {
        element: (
            <WorkspaceProvider>
                <DataProvider>
                    <Layout>
                        <ProtectedRoute />
                    </Layout>
                </DataProvider>
            </WorkspaceProvider>
        ),
        children: routes
    }
];

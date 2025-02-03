import { RouteObject } from 'react-router-dom';
import { ProtectedRoute } from '../components/Shared/protected-route';
import { DataProvider } from '../context/data-context';
import { Layout } from '../components/Shared/layout';
import { WorkspaceProvider } from '../context/workspace-context';
import { WebSocketProvider } from '../context/websocket-context';

export const protectRoutes = (routes: RouteObject[]): RouteObject[] => [
    {
        element: (
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
        children: routes
    }
];

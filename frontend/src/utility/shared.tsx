import React from 'react';
import { RouteObject } from 'react-router-dom';
import { ProtectedRoute } from '../components/Shared/protected_route';

export const protectRoutes = (routes: RouteObject[]): RouteObject[] => [
    {
        element: <ProtectedRoute />,
        children: routes
    }
];

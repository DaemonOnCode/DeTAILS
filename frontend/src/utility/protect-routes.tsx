import { RouteObject } from 'react-router-dom';

export const protectRoutes = (routes: RouteObject[], element: React.ReactNode): RouteObject[] => [
    {
        element: element,
        children: routes
    }
];

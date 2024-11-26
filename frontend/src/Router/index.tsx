import { FC } from 'react';
import { RouteObject, useRoutes } from 'react-router-dom';
import { CodingRoutes } from './coding_routes';
import { SharedRoutes } from './shared_routes';

export const AppRoutes: RouteObject[] = [
    {
        path: '/',
        children: SharedRoutes
    },
    {
        path: 'data-sources',
        element: <div>Data Sources</div>
    },
    {
        path: 'cleaning',
        element: <div>Cleaning</div>
    },
    {
        path: 'modelling',
        element: <div>Modelling</div>
    },
    {
        path: 'coding',
        children: CodingRoutes
    }
];

export const ApplicationRouter: FC = () => {
    const routes = useRoutes(AppRoutes);
    console.log(routes);
    return routes;
};

import { FC } from 'react';
import { RouteObject, useRoutes } from 'react-router-dom';
import { protectRoutes } from '../utility/protect_routes';
import { ROUTES } from '../constants/Shared';
import { SharedRouter } from './shared_router';
import { CodingRouter } from './coding_router';

export const AppRoutes: RouteObject[] = [
    {
        path: '/',
        children: SharedRouter
    },
    {
        children: protectRoutes([
            {
                path: ROUTES.DATA_SOURCES,
                element: <div>Data Sources</div>
            },
            {
                path: ROUTES.CLEANING,
                element: <div>Cleaning</div>
            },
            {
                path: ROUTES.MODELLING,
                element: <div>Modelling</div>
            },
            {
                path: ROUTES.CODING,
                children: CodingRouter
            }
        ])
    }
];

export const ApplicationRouter: FC = () => {
    const routes = useRoutes(AppRoutes);
    console.log(routes);
    return routes;
};

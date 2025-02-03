import { FC } from 'react';
import { RouteObject, useRoutes } from 'react-router-dom';
import { protectRoutes } from '../utility/protect-routes';
import { ROUTES } from '../constants/Shared';
import { SharedRouter } from './shared-router';
import { CodingRouter } from './coding-router';
import { DataCollectionRouter } from './data-collection-router';
import { DataModelingRouter } from './data-modeling-router';
import { DataCleaningRouter } from './data-cleaning-router';
import WorkspacePage from '../pages/Shared/workspace';

export const AppRoutes: RouteObject[] = [
    {
        path: '/',
        children: SharedRouter
    },
    {
        children: protectRoutes([
            {
                path: ROUTES.WORKSPACE,
                element: <WorkspacePage />
            },
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
        ])
    }
];

export const ApplicationRouter: FC = () => {
    const routes = useRoutes(AppRoutes);
    return routes;
};

import { FC } from 'react';
import { RouteObject, useRoutes } from 'react-router-dom';
import { protectRoutes } from '../utility/protect_routes';
import { ROUTES } from '../constants/Shared';
import { SharedRouter } from './shared_router';
import { CodingRouter } from './coding_router';
import { DataCollectionRouter } from './data_collection_router';
import { DataModelingRouter } from './data_modeling_router';
import { DataCleaningRouter } from './data_cleaning_router';
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

import { RouteObject } from 'react-router-dom';
import { ROUTES } from '../constants/DataModeling/shared';
import { HomePage, ModelsPage } from '../pages/DataModeling';

export const DataModelingRouter: RouteObject[] = [
    { path: ROUTES.HOME, element: <HomePage />, index: true },
    {
        path: ROUTES.MODELS,
        element: <ModelsPage />
    }
];

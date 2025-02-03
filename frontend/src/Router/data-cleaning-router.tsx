import { RouteObject } from 'react-router-dom';
import { ROUTES } from '../constants/DataCleaning/shared';
import { HomePage } from '../pages/DataCleaning';

export const DataCleaningRouter: RouteObject[] = [
    { path: ROUTES.HOME, element: <HomePage />, index: true }
];

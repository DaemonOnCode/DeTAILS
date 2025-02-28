import { RouteObject } from 'react-router-dom';
import { ROUTES } from '../constants/DataCollection/shared';
import { HomePage } from '../pages/DataCollection';

export const DataCollectionRouter: RouteObject[] = [
    { path: ROUTES.HOME, element: <HomePage />, index: true }
    // {
    //     path: ROUTES.LOAD_REDDIT,
    //     element: <LoadRedditPage />
    // }
];

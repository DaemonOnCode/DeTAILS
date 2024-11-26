import { RouteObject } from 'react-router-dom';
import NotFoundPage from '../pages/Shared/not_found';
import { ROUTES } from '../constants/Shared';

export const SharedRoutes: RouteObject[] = [
    {
        path: '',
        index: true,
        element: <div>Home</div>
    },
    { path: ROUTES.NOT_FOUND, element: <NotFoundPage /> }
];

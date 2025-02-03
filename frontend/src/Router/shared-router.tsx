import { RouteObject } from 'react-router-dom';
import NotFoundPage from '../pages/Shared/not-found';
import { ROUTES } from '../constants/Shared';
import LoginPage from '../pages/Login';
import HomePage from '../pages/Shared/home';

export const SharedRouter: RouteObject[] = [
    {
        path: '/',
        index: true,
        element: <HomePage />
    },
    { path: ROUTES.NOT_FOUND, element: <NotFoundPage /> },
    {
        path: ROUTES.LOGIN,
        element: <LoginPage />
    },
    {
        path: ROUTES.LOGOUT,
        element: <div>Logout</div>
    },
    {
        path: ROUTES.UNAUTHORIZED,
        element: <div>Unauthorized</div>
    }
];

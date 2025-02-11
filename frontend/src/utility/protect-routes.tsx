import { RouteObject } from 'react-router-dom';
import { AppRouteArray } from '../types/Shared';

export const protectRoutes = (routes: RouteObject[], element: React.ReactNode): RouteObject[] => [
    {
        element: element,
        children: routes
    }
];

export const recursivePathHider = (
    routes: RouteObject[],
    exclusionList: string[] = []
): AppRouteArray => {
    let newRoutes: AppRouteArray = [...routes];
    return newRoutes.map((route) => {
        const newRoute = { ...route };

        if (newRoute.children) {
            newRoute.children = recursivePathHider(newRoute.children, exclusionList);
        }

        if (exclusionList.includes(newRoute.path ?? '')) {
            newRoute.hidden = true;
        } else {
            newRoute.hidden = false;
        }

        return newRoute;
    });
};

import { ROUTES as SHARED_ROUTES } from '../constants/Shared';

export const getLoaderAbsoluteUrl = (
    loaderURL: string,
    routeSection: string,
    queryParams?: Record<string, string>
) => {
    if (queryParams) {
        const params = new URLSearchParams(queryParams);
        return `/${routeSection}/loader/${loaderURL}?${params.toString()}`;
    }
    return `/${routeSection}/loader/${loaderURL}`;
};

export const getCodingLoaderUrl = (loaderURL: string, queryParams?: Record<string, string>) => {
    if (queryParams) {
        return getLoaderAbsoluteUrl(loaderURL, SHARED_ROUTES.CODING, queryParams);
    }
    return getLoaderAbsoluteUrl(loaderURL, SHARED_ROUTES.CODING);
};

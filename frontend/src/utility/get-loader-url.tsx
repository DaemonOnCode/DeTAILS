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
        return getLoaderAbsoluteUrl(loaderURL, 'coding', queryParams);
    }
    return getLoaderAbsoluteUrl(loaderURL, 'coding');
};

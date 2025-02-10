export const getLoaderAbsoluteUrl = (loaderURL: string, routeSection: string) => {
    return `/${routeSection}/loader/${loaderURL}`;
};

export const getCodingLoaderUrl = (loaderURL: string) => {
    return getLoaderAbsoluteUrl(loaderURL, 'coding');
};

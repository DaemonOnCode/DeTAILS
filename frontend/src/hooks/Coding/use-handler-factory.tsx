import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useLoadingContext } from '../../context/loading-context';
import { useLogger } from '../../context/logging-context';
import { getCodingLoaderUrl } from '../../utility/get-loader-url';
import { useApi } from '../Shared/use-api';

export type HandlerConfig<T> = {
    startLog: string;
    doneLog?: string;
    loadingRoute: string;
    loaderRoute: string;
    loaderParams?: Record<string, any>;
    remoteRoute: string;
    useLLM?: boolean;
    buildBody: () => any;
    nextRoute?: string;
    onSuccess?: (data: T) => void;
    checkUnsaved?: () => void;
    errorRoute?: string;
};

export type RetryHandlerConfig<T> = {
    startLog: string;
    doneLog?: string;
    loadingRoute: string;
    loaderRoute?: string;
    loaderParams?: Record<string, any>;
    remoteRoute: string;
    useLLM?: boolean;
    buildBody?: () => any;
    nextRoute?: string;
    onSuccess?: (data: T) => void;
    onError?: (error: any) => void;
    errorRoute?: string;
};

export function useNextHandler<T>(config: HandlerConfig<T>) {
    const navigate = useNavigate();
    const { loadingDispatch } = useLoadingContext();
    const logger = useLogger();
    const { fetchData, fetchLLMData } = useApi();
    const location = useLocation();

    return useCallback(
        async (e?: React.SyntheticEvent) => {
            config.checkUnsaved?.();

            e?.preventDefault?.();
            loadingDispatch({ type: 'SET_LOADING_ROUTE', route: config.loadingRoute });

            logger.info(config.startLog);
            navigate(getCodingLoaderUrl(config.loaderRoute, config.loaderParams || {}));

            const body = config.buildBody();
            const opts = { method: 'POST', body: typeof body === 'string' ? body : body };

            let response;
            if (config.useLLM) {
                response = await fetchLLMData<T>(config.remoteRoute, opts);
            } else {
                response = await fetchData<T>(config.remoteRoute, opts);
            }
            const { data, error } = response;

            if (error) {
                console.error(`${config.startLog} error:`, error);
                if (error.name !== 'AbortError') {
                    toast.error(`${config.startLog} failed. ${error.message ?? ''}`);
                    if (config.nextRoute)
                        navigate(config.nextRoute ?? `${location.pathname}${location.search}`);
                    else navigate(config.errorRoute ?? `${location.pathname}${location.search}`);
                    loadingDispatch({
                        type: 'SET_LOADING_DONE_ROUTE',
                        route: config.loadingRoute
                    });
                    throw new Error(JSON.stringify(error.message));
                }
                return true;
            }

            if (config.doneLog) await logger.info(config.doneLog);
            config.onSuccess?.(data as T);

            loadingDispatch({
                type: 'SET_LOADING_DONE_ROUTE',
                route: config.loadingRoute
            });
            if (config.nextRoute) navigate(config.nextRoute);
        },
        [config, fetchData, fetchLLMData]
    );
}

export function useRetryHandler<T = any>(config: RetryHandlerConfig<T>) {
    const navigate = useNavigate();
    const { loadingDispatch } = useLoadingContext();
    const logger = useLogger();
    const { fetchData, fetchLLMData } = useApi();
    const location = useLocation();

    return useCallback(async () => {
        await logger.info(config.startLog);
        loadingDispatch({ type: 'SET_LOADING_ROUTE', route: config.loadingRoute });

        if (config.loaderRoute) {
            navigate(getCodingLoaderUrl(config.loaderRoute, config.loaderParams || {}));
        }

        const body = config.buildBody ? config.buildBody() : undefined;
        const opts =
            body != null
                ? { method: 'POST', body: typeof body === 'string' ? body : body }
                : { method: 'POST' };

        const response = config.useLLM
            ? await fetchLLMData<T>(config.remoteRoute, opts)
            : await fetchData<T>(config.remoteRoute, opts);
        const { data, error } = response;

        if (error) {
            console.error(`${config.startLog} error:`, error);
            if (error.name !== 'AbortError') {
                config.onError?.(error);
                toast.error(JSON.stringify(error.message) ?? `${config.startLog} failed.`);
                loadingDispatch({
                    type: 'SET_LOADING_DONE_ROUTE',
                    route: config.loadingRoute
                });
                navigate(config.errorRoute ?? `${location.pathname}${location.search}`);
            }
            return true;
        }

        if (config.doneLog) await logger.info(config.doneLog);
        config.onSuccess?.(data as T);

        loadingDispatch({
            type: 'SET_LOADING_DONE_ROUTE',
            route: config.loadingRoute
        });
        navigate(config.nextRoute ?? config.loadingRoute);
    }, [fetchData, fetchLLMData, config]);
}

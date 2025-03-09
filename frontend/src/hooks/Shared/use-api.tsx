import { useCallback } from 'react';
import useServerUtils from '../../hooks/Shared/get-server-url';
import { useSettings } from '../../context/settings-context';
import { useLoadingContext } from '../../context/loading-context';
import { useLocation } from 'react-router-dom';

export type FetchResponse<T = any> =
    | { data: T; error?: never; abort: () => void }
    | { error: Error; data?: never; abort: () => void };

export type FetchRequest<T = any> = (
    route: string,
    options?: RequestInit & { rawResponse?: boolean },
    customAbortController?: AbortController | null
) => Promise<FetchResponse<T>>;

export interface UseApiResult {
    fetchData: <T = any>(...args: Parameters<FetchRequest<T>>) => ReturnType<FetchRequest<T>>;
}

export const useApi = (): UseApiResult => {
    const { getServerUrl } = useServerUtils();
    const { settings } = useSettings();
    const location = useLocation();

    const { requestArrayRef } = useLoadingContext();

    const fetchData = useCallback(
        async <T = any,>(
            route: string,
            options: RequestInit & { rawResponse?: boolean } = {},
            customAbortController: AbortController | null = null
        ): Promise<FetchResponse<T>> => {
            const { rawResponse, ...restOptions } = options;
            const controller = customAbortController || new AbortController();
            const url = getServerUrl(route);

            // Merge default headers with any provided headers.
            const defaultHeaders: Record<string, string> = {
                'Content-Type': 'application/json',
                'X-App-ID': settings.app.id
            };

            // If the body is a FormData instance, do not set the Content-Type header.
            const isFormData = restOptions.body instanceof FormData;
            const mergedHeaders = isFormData
                ? {
                      ...((restOptions.headers as Record<string, string>) || {}),
                      'X-App-ID': settings.app.id
                  }
                : { ...defaultHeaders, ...(restOptions.headers || {}) };

            const mergedOptions: RequestInit = {
                ...restOptions,
                headers: mergedHeaders,
                signal: controller.signal
            };

            if (requestArrayRef.current !== null) {
                requestArrayRef.current[location.pathname] = [
                    ...(requestArrayRef.current[location.pathname] || []),
                    controller.abort.bind(controller)
                ];
            }

            try {
                const response = await fetch(url, mergedOptions);

                if (!response.ok) {
                    return {
                        data: undefined,
                        error: new Error(
                            `HTTP error! Status: ${response.status}, ${await response.text()}`
                        ),
                        abort: controller.abort.bind(controller)
                    };
                }

                if (rawResponse) {
                    return { data: response as any, abort: controller.abort.bind(controller) };
                }

                const data = (await response.json()) as T;
                return { data, abort: controller.abort.bind(controller) };
            } catch (error: any) {
                console.error('Fetch error:', error);
                return { data: undefined, error, abort: controller.abort.bind(controller) };
            }
        },
        [getServerUrl, settings.app.id]
    );

    return { fetchData };
};

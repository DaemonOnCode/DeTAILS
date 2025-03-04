import { useCallback } from 'react';
import useServerUtils from '../../hooks/Shared/get-server-url';
import { useSettings } from '../../context/settings-context';

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

    const fetchData = useCallback(
        async <T = any,>(
            route: string,
            options: RequestInit & { rawResponse?: boolean } = {},
            customAbortController: AbortController | null = null
        ): Promise<FetchResponse<T>> => {
            // Extract rawResponse flag and the remaining options.
            const { rawResponse, ...restOptions } = options;
            // Use the provided AbortController or create a new one.
            const controller = customAbortController || new AbortController();
            const url = getServerUrl(route);

            // Merge default headers with extra headers from settings and any provided options.
            const defaultHeaders: Record<string, string> = {
                'Content-Type': 'application/json',
                'X-App-ID': settings.app.id
            };

            const mergedOptions: RequestInit = {
                ...restOptions,
                headers: {
                    ...defaultHeaders,
                    ...(restOptions.headers || {})
                },
                signal: controller.signal
            };

            try {
                const response = await fetch(url, mergedOptions);

                if (!response.ok) {
                    return {
                        data: undefined,
                        error: new Error(`HTTP error! Status: ${response.status}`),
                        abort: controller.abort.bind(controller)
                    };
                }

                // If rawResponse is true, return the response object as data.
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

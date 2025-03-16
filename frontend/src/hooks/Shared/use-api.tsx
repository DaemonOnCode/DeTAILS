import { useCallback } from 'react';
import useServerUtils from '../../hooks/Shared/get-server-url';
import { useSettings } from '../../context/settings-context';
import { useLoadingContext } from '../../context/loading-context';
import { useLocation } from 'react-router-dom';
import { REMOTE_SERVER_ROUTES } from '../../constants/Shared';

export type FetchResponse<T = any> =
    | { data: T; error?: never; abort: () => void }
    | {
          error: {
              message: {
                  error_message: string;
                  error: string;
              };
              name: string;
          };
          data?: never;
          abort: () => void;
      };

export type FetchRequest<T = any> = (
    route: string,
    options?: RequestInit & { rawResponse?: boolean },
    customAbortController?: AbortController | null
) => Promise<FetchResponse<T>>;

export type FetchLLMResponse<T = any> =
    | { data: T; error?: never; abort: () => void }
    | {
          error: {
              message: string;
              name: string;
          };
          data?: never;
          abort: () => void;
      };

export type FetchLLMRequest<T = any> = (
    route: string,
    options?: RequestInit & { rawResponse?: boolean },
    customAbortController?: AbortController | null
) => Promise<FetchLLMResponse<T>>;

export interface UseApiResult {
    fetchData: <T = any>(...args: Parameters<FetchRequest<T>>) => ReturnType<FetchRequest<T>>;
    fetchLLMData: <T = any>(
        ...args: Parameters<FetchLLMRequest<T>>
    ) => ReturnType<FetchLLMRequest<T>>;
}

export const useApi = (): UseApiResult => {
    const { getServerUrl } = useServerUtils();
    const { settings, updateSettings } = useSettings();
    const location = useLocation();
    const { requestArrayRef, openCredentialModalForCredentialError } = useLoadingContext();

    const fetchData = useCallback(
        async <T = any,>(
            route: string,
            options: RequestInit & { rawResponse?: boolean } = {},
            customAbortController: AbortController | null = null
        ): Promise<FetchResponse<T>> => {
            const { rawResponse, ...restOptions } = options;
            const controller = customAbortController || new AbortController();
            const url = getServerUrl(route);

            const defaultHeaders: Record<string, string> = {
                'Content-Type': 'application/json',
                'X-App-ID': settings.app.id
            };

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
                console.log('Request array ref is not null for:', location.pathname);
                requestArrayRef.current[location.pathname] = [
                    ...(requestArrayRef.current[location.pathname] || []),
                    controller.abort.bind(controller)
                ];
            } else {
                console.log('Request array ref is null for:', location.pathname);
            }

            try {
                const response = await fetch(url, mergedOptions);

                if (!response.ok) {
                    try {
                        const errorResponse = await response.json();
                        return {
                            error: {
                                message: {
                                    error_message: errorResponse.error_message,
                                    error: errorResponse.error
                                },
                                name: 'FetchError'
                            },
                            abort: controller.abort.bind(controller)
                        };
                    } catch (e) {
                        console.error('Error fetching data:', e);
                        return {
                            error: {
                                message: {
                                    error_message: 'Error fetching data',
                                    error: 'FetchError'
                                },
                                name: 'FetchError'
                            },
                            abort: controller.abort.bind(controller)
                        };
                    }
                }

                if (rawResponse) {
                    return { data: response as any, abort: controller.abort.bind(controller) };
                }

                const data = (await response.json()) as T;
                return { data, abort: controller.abort.bind(controller) };
            } catch (error: any) {
                console.error('Fetch error:', error);
                return {
                    error: {
                        message: error,
                        name: 'FetchError'
                    },
                    abort: controller.abort.bind(controller)
                };
            }
        },
        [getServerUrl, settings.app.id, location.pathname, requestArrayRef]
    );

    const fetchLLMData = useCallback(
        async <T = any,>(
            route: string,
            options: RequestInit & { rawResponse?: boolean } = {},
            customAbortController: AbortController | null = null
        ): Promise<FetchLLMResponse<T>> => {
            console.log('Fetching LLM data:', route, options, settings);
            if (settings.ai.model.startsWith('google')) {
                // Check credentials using the current file path.
                let credentialsResponse = await fetchData(REMOTE_SERVER_ROUTES.CHECK_CREDENTIALS, {
                    method: 'POST',
                    body: JSON.stringify({
                        credential_path: settings.ai.googleCredentialsPath
                    })
                });

                // If credentials are invalid, show the credential modal until valid credentials are provided or the user cancels.
                while (credentialsResponse.error) {
                    const errorMessage =
                        credentialsResponse.error?.message.error_message ?? 'Invalid credentials';
                    // The promise now resolves to a string or null.
                    const newCredentialPath: string | null = await new Promise((resolve) => {
                        openCredentialModalForCredentialError(errorMessage, resolve);
                    });
                    // If the user cancels (null), exit and return the credentials error.
                    if (newCredentialPath === null) {
                        return {
                            error: {
                                message: 'User cancelled credential input',
                                name: 'CredentialError'
                            },
                            abort: () => {}
                        };
                    }
                    // Update the settings with the new credential file path.
                    await updateSettings('ai', { googleCredentialsPath: newCredentialPath });

                    // Re-run the credentials check with the updated file path.
                    credentialsResponse = await fetchData(REMOTE_SERVER_ROUTES.CHECK_CREDENTIALS, {
                        method: 'POST',
                        body: JSON.stringify({
                            credential_path: newCredentialPath
                        })
                    });
                }
            }
            // Once credentials are valid, perform the LLM call.
            const result = await fetchData(route, options, customAbortController);
            if (result.error) {
                return {
                    error: {
                        message:
                            typeof result.error.message === 'object'
                                ? result.error.message.error_message
                                : result.error.message,
                        name: result.error.name
                    },
                    abort: result.abort
                };
            } else {
                return result as { data: T; abort: () => void };
            }
        },
        [fetchData, openCredentialModalForCredentialError, settings, updateSettings]
    );

    return { fetchData, fetchLLMData };
};

import { useCallback } from 'react';
import useServerUtils from '../../hooks/Shared/get-server-url';
import { useSettings } from '../../context/settings-context';
import { useLoadingContext } from '../../context/loading-context';
import { useLocation } from 'react-router-dom';
import { REMOTE_SERVER_ROUTES } from '../../constants/Shared';
import { useWorkspaceContext } from '../../context/workspace-context';

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
    const { currentWorkspace } = useWorkspaceContext();
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
                'X-App-ID': settings.app.id,
                'X-Workspace-ID': currentWorkspace?.id ?? ''
            };

            const isFormData = restOptions.body instanceof FormData;
            const mergedHeaders = isFormData
                ? {
                      ...((restOptions.headers as Record<string, string>) || {}),
                      'X-App-ID': settings.app.id,
                      'X-Workspace-ID': currentWorkspace?.id || ''
                  }
                : { ...defaultHeaders, ...(restOptions.headers || {}) };

            const mergedOptions: RequestInit = {
                ...restOptions,
                headers: mergedHeaders,
                signal: controller.signal
            };
            // console.log('Fetching data:', url, mergedOptions);

            if (route === REMOTE_SERVER_ROUTES.SAVE_STATE) {
                console.log('Saving state:', location.pathname);
            } else {
                if (requestArrayRef.current !== null) {
                    console.log('Request array ref is not null for:', location.pathname);
                    requestArrayRef.current[location.pathname] = [
                        ...(requestArrayRef.current[location.pathname] || []),
                        controller.abort.bind(controller)
                    ];
                } else {
                    console.log('Request array ref is null for:', location.pathname, 'save state');
                }
            }

            try {
                const response = await fetch(url, mergedOptions);

                console.log('Request did not abort');

                if (!response.ok) {
                    try {
                        const text = await response.text();
                        console.log('Error while request:', text);
                        const errorResponse: {
                            error_message: string;
                            error: string;
                        } = JSON.parse(text);
                        return {
                            error: {
                                message: {
                                    ...errorResponse
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
                console.log('Fetch error:', error);
                return {
                    error: {
                        message: {
                            error: 'Fetch error',
                            error_message: 'Error fetching data'
                        },
                        name: 'AbortError'
                    },
                    abort: controller.abort.bind(controller)
                };
            }
        },
        [getServerUrl, settings.app.id, location.pathname, requestArrayRef]
    );

    function hasCredentialsPath(
        settings:
            | { apiKey: string; modelList: string[]; textEmbedding: string }
            | { modelList: string[]; textEmbedding: string; credentialsPath: string }
    ): settings is { modelList: string[]; textEmbedding: string; credentialsPath: string } {
        return 'credentialsPath' in settings;
    }

    function hasApiKey(
        settings:
            | { apiKey: string; modelList: string[]; textEmbedding: string }
            | { modelList: string[]; textEmbedding: string; credentialsPath: string }
    ): settings is { apiKey: string; modelList: string[]; textEmbedding: string } {
        return 'apiKey' in settings;
    }

    const fetchLLMData = useCallback(
        async <T = any,>(
            route: string,
            options: RequestInit & { rawResponse?: boolean } = {},
            customAbortController: AbortController | null = null
        ): Promise<FetchLLMResponse<T>> => {
            console.log('Fetching LLM data:', route, options, settings);

            const [provider, ...modelParts] = settings.ai.model.split('-');
            const model = modelParts.join('-');
            const providerSettings = settings.ai.providers[provider];

            if (provider === 'vertexai' && hasCredentialsPath(providerSettings)) {
                let credentialsResponse = await fetchData(REMOTE_SERVER_ROUTES.CHECK_CREDENTIALS, {
                    method: 'POST',
                    body: JSON.stringify({
                        provider: 'vertexai',
                        credential: providerSettings.credentialsPath
                    })
                });

                while (credentialsResponse.error) {
                    const errorMessage =
                        credentialsResponse.error?.message.error_message ?? 'Invalid credentials';
                    const newCredentialPath: string | null = await new Promise((resolve) => {
                        openCredentialModalForCredentialError(errorMessage, resolve);
                    });

                    if (newCredentialPath === null) {
                        return {
                            error: {
                                message: 'User cancelled credential input',
                                name: 'CredentialError'
                            },
                            abort: () => {}
                        };
                    }

                    await updateSettings('ai', {
                        providers: {
                            vertexai: {
                                ...providerSettings,
                                credentialsPath: newCredentialPath
                            }
                        }
                    });

                    credentialsResponse = await fetchData(REMOTE_SERVER_ROUTES.CHECK_CREDENTIALS, {
                        method: 'POST',
                        body: JSON.stringify({
                            provider: 'vertexai',
                            credential: newCredentialPath
                        })
                    });
                }
            } else if (hasApiKey(providerSettings)) {
                if (!providerSettings.apiKey) {
                    return {
                        error: {
                            message: 'API key is missing',
                            name: 'CredentialError'
                        },
                        abort: () => {}
                    };
                }
            }

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

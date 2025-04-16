import { useRef, useEffect, RefObject, useImperativeHandle, Dispatch } from 'react';
import { useLoadingContext } from '../../context/loading-context';
import { StepHandle } from '../../types/Shared';
import { SetState } from '../../types/Coding/shared';
import { useApi } from './use-api';
import { REMOTE_SERVER_ROUTES } from '../../constants/Shared';

export interface LoadingHandlerRef {
    resetStep: (currentPath: string) => Promise<void>;
    checkDataExistence: (currentPath: string) => Promise<boolean>;
    downloadData: (currentPath: string) => Promise<void>;
}

export type LoadingStateInitialization = Record<
    string,
    {
        relatedStates: {
            name: string;
        }[];
        downloadData?: { name: string; condition?: boolean };
    }
>;

export function useLoadingSteps(
    loadingStateInitialization: LoadingStateInitialization,
    pathRef: RefObject<StepHandle>
) {
    const { loadingState } = useLoadingContext();
    const { fetchData } = useApi();

    useImperativeHandle(
        pathRef,
        () => ({
            resetStep: async (currentPath: string) => {
                console.log('Resetting states for path:', currentPath);
                const config = loadingStateInitialization[currentPath];
                if (!config) {
                    console.warn('No config found for path:', currentPath);
                    return;
                }
                const { data, error } = await fetchData(REMOTE_SERVER_ROUTES.RESET_CONTEXT_DATA, {
                    method: 'POST',
                    body: JSON.stringify({ page: currentPath })
                });
            },
            checkDataExistence: async (currentPath: string) => {
                console.log('Checking data existence for path:', currentPath);
                const config = loadingStateInitialization[currentPath];
                if (!config) return false;
                const { data, error } = await fetchData(
                    REMOTE_SERVER_ROUTES.CHECK_CONTEXT_DATA_EXISTS,
                    {
                        method: 'POST',
                        body: JSON.stringify({ page: currentPath })
                    }
                );

                console.log('Data existence check result:', data, error);

                return data.exists ?? false;
            },
            downloadData: async (currentPath: string) => {
                console.log('Downloading data for path:', currentPath);
                if (loadingStateInitialization[currentPath]?.downloadData) {
                    const { name, condition } =
                        loadingStateInitialization[currentPath].downloadData!;
                    if (condition !== false) {
                        const { data, error } = await fetchData(
                            REMOTE_SERVER_ROUTES.DOWNLOAD_CONTEXT_DATA,
                            {
                                method: 'POST',
                                body: JSON.stringify({ page: currentPath }),
                                rawResponse: true
                            }
                        );
                        let filename = 'downloaded_file.csv';
                        const contentDisposition = data.headers.get('Content-Disposition');
                        if (contentDisposition) {
                            const match = contentDisposition.match(/filename="?(.+)"?/);
                            if (match && match[1]) {
                                filename = match[1];
                            }
                        }
                        if ('showSaveFilePicker' in window) {
                            try {
                                const fileHandle = await (window as any).showSaveFilePicker({
                                    suggestedName: filename,
                                    types: [
                                        {
                                            description: 'CSV Files',
                                            accept: { 'text/csv': ['.csv'] }
                                        }
                                    ]
                                });

                                const writableStream = await fileHandle.createWritable();

                                const reader = data.body.getReader();

                                const pump = async () => {
                                    const { done, value } = await reader.read();
                                    if (done) {
                                        await writableStream.close();
                                        console.log('File streaming complete');
                                        return;
                                    }
                                    await writableStream.write(value);
                                    await pump();
                                };

                                await pump();
                            } catch (error) {
                                console.error('Error streaming file:', error);
                            }
                        } else {
                            const blob = await data.blob();
                            const downloadUrl = window.URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = downloadUrl;
                            link.download = 'downloaded_file.csv';
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            window.URL.revokeObjectURL(downloadUrl);
                            console.log('File downloaded using fallback method');
                        }
                        console.log(`Data downloaded for route: ${currentPath}`);
                    }
                }
            }
        }),
        [loadingStateInitialization, loadingState]
    );
}

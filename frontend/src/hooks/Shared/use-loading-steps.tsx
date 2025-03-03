import { useRef, useEffect, RefObject, useImperativeHandle, Dispatch } from 'react';
import { useLoadingContext } from '../../context/loading-context';
import { StepHandle } from '../../types/Shared';
import { SetState } from '../../types/Coding/shared';
const { ipcRenderer } = window.require('electron');

export interface LoadingHandlerRef {
    resetStep: (currentPath: string) => void;
    checkDataExistence: (currentPath: string) => boolean;
    downloadData: (currentPath: string) => Promise<void>;
}

export type LoadingStateInitialization = Record<
    string,
    {
        relatedStates: {
            state: any;
            func: SetState<any> | Dispatch<any>;
            name: string;
            initValue?: any;
        }[];
        downloadData?: { name: string; data: any[]; condition?: boolean };
    }
>;

export function useLoadingSteps(
    loadingStateInitialization: LoadingStateInitialization,
    pathRef: RefObject<StepHandle>
) {
    const { loadingState } = useLoadingContext();

    // const handlerRef = useRef<LoadingHandlerRef>({
    //     resetStep: () => {},
    //     checkDataExistence: () => false,
    //     downloadData: async () => {}
    // });

    useImperativeHandle(
        pathRef,
        () => ({
            resetStep: (currentPath: string) => {
                console.log('Resetting states for path:', currentPath);
                const config = loadingStateInitialization[currentPath];
                if (!config) {
                    console.warn('No config found for path:', currentPath);
                    return;
                }
                config.relatedStates.forEach(({ state, func, name, initValue }: any) => {
                    if (name.startsWith('set')) {
                        const getDefaultValue = (val: unknown) => {
                            if (Array.isArray(val)) return [];
                            if (typeof val === 'string') return '';
                            if (typeof val === 'number') return 0;
                            return {};
                        };
                        func(initValue !== undefined ? initValue : getDefaultValue(state));
                    } else {
                        func({ type: 'RESET' });
                    }
                });
            },

            checkDataExistence: (currentPath: string) => {
                console.log('Checking data existence for path:', currentPath);
                const config = loadingStateInitialization[currentPath];
                if (!config) return false;
                return config.relatedStates.some(({ state }: any) => {
                    if (Array.isArray(state)) return state.length > 0;
                    if (typeof state === 'string') return state.trim() !== '';
                    if (typeof state === 'number') return state !== 0;
                    if (state && typeof state === 'object') return Object.keys(state).length > 0;
                    return false;
                });
            },

            downloadData: async (currentPath: string) => {
                console.log('Downloading data for path:', currentPath);
                if (
                    loadingState[currentPath]?.downloadData &&
                    loadingStateInitialization[currentPath]?.downloadData
                ) {
                    const { data, name, condition } =
                        loadingStateInitialization[currentPath].downloadData!;
                    if (data.length > 0 && condition !== false) {
                        await ipcRenderer.invoke('save-csv', { data, fileName: name });
                        console.log(`Data downloaded for route: ${currentPath}`);
                    }
                }
            }
        }),
        [loadingStateInitialization]
    );
}

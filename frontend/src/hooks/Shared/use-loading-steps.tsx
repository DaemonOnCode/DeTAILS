import { Dispatch, useEffect } from 'react';
import { SetState } from '../../types/Coding/shared';
import { useLoadingContext } from '../../context/loading-context';

const { ipcRenderer } = window.require('electron');

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

export function useLoadingSteps(loadingStateInitialization: LoadingStateInitialization) {
    const { loadingState } = useLoadingContext();
    useEffect(() => {
        // Loop through *all* routes in your loadingStateInitialization
        for (const [routeKey, routeConfig] of Object.entries(loadingStateInitialization)) {
            console.log('useLoadingSteps – Setting up route:', routeKey);
            const routeState = loadingState[routeKey];
            console.log('useLoadingSteps – routeState:', routeState);
            if (!routeState?.stepRef?.current) {
                console.log('No stepRef.current, skipping', routeKey);
                continue;
            }

            const stepRef = routeState.stepRef.current;

            /**
             * Reset only the states belonging to this specific route.
             */
            stepRef.resetStep = (currentPath: string) => {
                console.log('Resetting states for path:', currentPath);
                loadingStateInitialization[currentPath]?.relatedStates.forEach(
                    ({ state, func, name, initValue }) => {
                        if (name.startsWith('set')) {
                            // We treat this as a standard setState
                            const getDefaultValue = (val: unknown) => {
                                if (Array.isArray(val)) return [];
                                if (typeof val === 'string') return '';
                                if (typeof val === 'number') return 0;
                                return {};
                            };

                            if (initValue !== undefined) {
                                (func as SetState<any>)(initValue);
                            } else {
                                (func as SetState<any>)(getDefaultValue(state));
                            }
                        } else {
                            // Otherwise, assume it's a reducer dispatch
                            (func as Dispatch<any>)({ type: 'RESET' });
                        }
                    }
                );
            };

            /**
             * Check if any data for this route's related states actually exists.
             */
            stepRef.checkDataExistence = (currentPath: string) => {
                console.log(
                    'Checking data existence for path:',
                    currentPath,
                    loadingStateInitialization[currentPath]
                );

                return loadingStateInitialization[currentPath]?.relatedStates.some(
                    ({ state, name }) => {
                        console.log(
                            'Checking data existence for state:',
                            name,
                            'in route:',
                            routeKey
                        );
                        if (Array.isArray(state)) return state.length > 0;
                        if (typeof state === 'string') return state.trim() !== '';
                        if (typeof state === 'number') return state !== 0;
                        if (state && typeof state === 'object') {
                            return Object.keys(state).length > 0;
                        }
                        return false;
                    }
                );
            };

            /**
             * Download data (if needed) for this route.
             */
            stepRef.downloadData = async (currentPath: string) => {
                console.log('downloadData for path:', currentPath);
                // Only do it if both the route’s loadingState and config say we have downloadData
                if (
                    routeState.downloadData &&
                    loadingStateInitialization[currentPath].downloadData
                ) {
                    const { data, name, condition } =
                        loadingStateInitialization[currentPath].downloadData!;
                    // Download if data is non-empty and condition is not false
                    if (data.length > 0 && condition !== false) {
                        await ipcRenderer.invoke('save-csv', {
                            data,
                            fileName: name
                        });
                        console.log(`Data downloaded for route: ${currentPath}`);
                    }
                }
            };
        }
    }, [
        ...Object.values(loadingStateInitialization).flatMap((config) =>
            config.relatedStates.map((item) => item.state)
        )
    ]);
}

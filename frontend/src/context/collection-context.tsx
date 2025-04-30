import React, {
    createContext,
    useState,
    useEffect,
    useContext,
    FC,
    Dispatch,
    useMemo
} from 'react';
import { useLocation } from 'react-router-dom';
import { v4 } from 'uuid';
import { useLoadingContext } from './loading-context';
import { PAGE_ROUTES as CODING_PAGE_ROUTES } from '../constants/Coding/shared';
import { REMOTE_SERVER_ROUTES } from '../constants/Shared';
import { useApi } from '../hooks/Shared/use-api';
import { SetState } from '../types/Coding/shared';
import { useLoadingSteps } from '../hooks/Shared/use-loading-steps';
import {
    ModeType,
    MetadataState,
    Dataset,
    RedditData,
    InterviewData,
    MetadataAction,
    DataAction
} from '../types/DataCollection/shared';
import { ICollectionContext } from '../types/Shared';

const defaultContext: ICollectionContext = {
    type: null,
    metadata: null,
    dataset: [],
    datasetId: '',
    modeInput: '',
    selectedData: [],
    dataFilters: {},
    isLocked: false,
    setType: async () => {},
    setModeInput: async () => {},
    setSelectedData: async () => {},
    setDataFilters: async () => {},
    setIsLocked: async () => {},
    setDatasetId: async () => {},
    updateContext: async () => {},
    resetContext: async () => {},
    metadataDispatch: () => {},
    datasetDispatch: () => {}
};

export const CollectionContext = createContext<ICollectionContext>(defaultContext);

export const CollectionProvider: FC<{ children: React.ReactNode }> = ({ children }) => {
    const location = useLocation();
    const { loadingState, lockedUpdate } = useLoadingContext();
    const { fetchData } = useApi();

    const [type, setTypeState] = useState<ModeType>(null);
    const [metadata, setMetadataState] = useState<MetadataState>(null);
    const [dataset, setDatasetState] = useState<Dataset>([]);
    const [datasetId, setDatasetIdState] = useState<string>(v4());
    const [modeInput, setModeInputState] = useState<string>('');
    const [selectedData, setSelectedDataState] = useState<string[]>([]);
    const [dataFilters, setDataFiltersState] = useState<Record<string, any>>({});
    const [isLocked, setIsLockedState] = useState<boolean>(false);

    const saveCollectionContext = async (operationType: string, payload: object) => {
        try {
            const { data, error } = await fetchData(REMOTE_SERVER_ROUTES.SAVE_COLLECTION_CONTEXT, {
                method: 'POST',
                body: JSON.stringify({ type: operationType, ...payload })
            });
            if (error) throw new Error(`Failed to save context for ${operationType}: ${error}`);
            return data;
        } catch (error) {
            console.error(`Error in ${operationType}:`, error);
            throw error;
        }
    };

    const fetchStates = async (stateNames: string[]) => {
        try {
            const { data, error } = await fetchData(REMOTE_SERVER_ROUTES.LOAD_COLLECTION_CONTEXT, {
                method: 'POST',
                body: JSON.stringify({ states: stateNames })
            });
            if (error) throw new Error(`Failed to fetch states: ${stateNames.join(', ')}`);
            return data;
        } catch (error) {
            console.error('Error fetching states:', JSON.stringify(error));
            throw error;
        }
    };

    const setType = async (newTypeOrFn: ModeType | ((prev: ModeType) => ModeType)) => {
        const newType = typeof newTypeOrFn === 'function' ? newTypeOrFn(type) : newTypeOrFn;
        return lockedUpdate('set-type', async () => {
            const data = await saveCollectionContext('setType', { newType });
            if (data.success) {
                setTypeState(newType);
                const fetchedData = await fetchStates(['metadata']);
                if (fetchedData.metadata) setMetadataState(fetchedData.metadata);
            }
            return data;
        });
    };

    const setMetadataSource = async (source: 'folder' | 'url') => {
        return lockedUpdate('set-metadata-source', async () => {
            const data = await saveCollectionContext('setMetadataSource', { source });
            if (data.success) {
                if (type === 'reddit') {
                    setMetadataState((prev) =>
                        prev && prev.type === 'reddit' ? { ...prev, source } : prev
                    );
                }
            }
            return data;
        });
    };

    const setMetadataSubreddit = async (subreddit: string) => {
        return lockedUpdate('set-metadata-subreddit', async () => {
            const data = await saveCollectionContext('setMetadataSubreddit', { subreddit });
            if (data.success && type === 'reddit') {
                setMetadataState((prev) =>
                    prev && prev.type === 'reddit' ? { ...prev, subreddit } : prev
                );
            }
            return data;
        });
    };

    const setModeInput = async (inputOrFn: string | ((prev: string) => string)) => {
        const _modeInput = typeof inputOrFn === 'function' ? inputOrFn(modeInput) : inputOrFn;
        return lockedUpdate('set-mode-input', async () => {
            const data = await saveCollectionContext('setModeInput', { modeInput: _modeInput });
            if (data.success) {
                setModeInputState(_modeInput);
            }
            return data;
        });
    };

    const setSelectedData = async (dataOrFn: string[] | ((prev: string[]) => string[])) => {
        const _selectedData = typeof dataOrFn === 'function' ? dataOrFn(selectedData) : dataOrFn;
        return lockedUpdate('set-selected-data', async () => {
            const data = await saveCollectionContext('setSelectedData', {
                selectedData: _selectedData
            });
            if (data.success) {
                setSelectedDataState(_selectedData);
            }
            return data;
        });
    };

    const setDataFilters = async (
        filtersOrFn: Record<string, any> | ((prev: Record<string, any>) => Record<string, any>)
    ) => {
        const _dataFilters =
            typeof filtersOrFn === 'function' ? filtersOrFn(dataFilters) : filtersOrFn;
        return lockedUpdate('set-data-filters', async () => {
            const data = await saveCollectionContext('setDataFilters', {
                dataFilters: _dataFilters
            });
            if (data.success) {
                setDataFiltersState(_dataFilters);
            }
            return data;
        });
    };

    const setIsLocked = async (lockedOrFn: boolean | ((prev: boolean) => boolean)) => {
        const _isLocked = typeof lockedOrFn === 'function' ? lockedOrFn(isLocked) : lockedOrFn;
        return lockedUpdate('set-is-locked', async () => {
            const data = await saveCollectionContext('setIsLocked', { isLocked: _isLocked });
            if (data.success) {
                setIsLockedState(_isLocked);
            }
            return data;
        });
    };

    const addDatasetItem = async (newData: RedditData | InterviewData) => {
        return lockedUpdate('add-dataset-item', async () => {
            const data = await saveCollectionContext('addDatasetItem', { data: newData });
            if (data.success) {
                setDatasetState((prev) => [...prev, newData]);
            }
            return data;
        });
    };

    const resetDataset = async () => {
        return lockedUpdate('reset-dataset', async () => {
            const data = await saveCollectionContext('resetDataset', {});
            if (data.success) {
                setDatasetState([]);
            }
            return data;
        });
    };

    const setDatasetId = async (datasetId: string) => {
        setDatasetIdState(datasetId);
    };

    const updateContext = async (updates: Partial<ICollectionContext>) => {
        if (updates.type !== undefined) await setType(updates.type);
        if (updates.metadata) {
            if (updates.metadata.source !== undefined)
                await setMetadataSource(updates.metadata.source);
            if (updates.metadata.type === 'reddit' && updates.metadata.subreddit !== undefined) {
                await setMetadataSubreddit(updates.metadata.subreddit);
            }
        }
        if (updates.modeInput !== undefined) await setModeInput(updates.modeInput);
        if (updates.selectedData !== undefined) await setSelectedData(updates.selectedData);
        if (updates.dataFilters !== undefined) await setDataFilters(updates.dataFilters);
        if (updates.isLocked !== undefined) await setIsLocked(updates.isLocked);
        if (updates.datasetId !== undefined) await setDatasetId(updates.datasetId);
    };

    const resetContext = async () => {
        const data = await saveCollectionContext('resetContext', {});
        if (data.success) {
            setTypeState(null);
            setMetadataState(null);
            // setDatasetState([]);
            // setDatasetIdState(v4());
            setModeInputState('');
            setSelectedDataState([]);
            setDataFiltersState({});
            setIsLockedState(false);
        }
    };

    const loadingStateInitialization: Record<
        string,
        {
            relatedStates: {
                name: string;
            }[];
            downloadData?: { name: string; condition?: boolean };
        }
    > = useMemo(
        () => ({
            [CODING_PAGE_ROUTES.DATA_TYPE]: {
                relatedStates: []
            },
            [CODING_PAGE_ROUTES.DATA_SOURCE]: {
                relatedStates: [
                    {
                        name: 'setModeInput'
                    }
                ]
            },
            [CODING_PAGE_ROUTES.DATASET_CREATION]: {
                relatedStates: [
                    {
                        name: 'setSelectedData'
                    },
                    {
                        name: 'setDataFilters'
                    },
                    {
                        name: 'setIsLocked'
                    }
                ]
            }
        }),
        [modeInput, selectedData, dataFilters]
    );

    useLoadingSteps(
        loadingStateInitialization,
        loadingState[CODING_PAGE_ROUTES.DATA_TYPE]?.stepRef
    );

    useLoadingSteps(
        loadingStateInitialization,
        loadingState[CODING_PAGE_ROUTES.DATA_SOURCE]?.stepRef
    );

    useLoadingSteps(
        loadingStateInitialization,
        loadingState[CODING_PAGE_ROUTES.DATASET_CREATION]?.stepRef
    );

    useEffect(() => {
        const page = location.pathname;
        const stateMap: Record<string, string[]> = {
            [CODING_PAGE_ROUTES.HOME]: [
                'type',
                'metadata',
                'datasetId',
                'modeInput',
                'isLocked',
                'dataFilters'
            ],
            [CODING_PAGE_ROUTES.DATA_TYPE]: ['type'],
            [CODING_PAGE_ROUTES.DATA_SOURCE]: ['metadata', 'modeInput'],
            [CODING_PAGE_ROUTES.DATASET_CREATION]: [
                'dataset',
                'selectedData',
                'dataFilters',
                'isLocked'
            ]
        };
        const statesToFetch = stateMap[page] || [];
        if (statesToFetch.length > 0) {
            (async () => {
                try {
                    const fetchedData = await fetchStates(statesToFetch);
                    console.log('Fetched data:', fetchedData);
                    if (fetchedData.type !== undefined) setTypeState(fetchedData.type || null);
                    if (fetchedData.metadata !== undefined)
                        setMetadataState(fetchedData.metadata || null);
                    if (fetchedData.dataset !== undefined)
                        setDatasetState(fetchedData.dataset || []);
                    if (fetchedData.modeInput !== undefined)
                        setModeInputState(fetchedData.modeInput || '');
                    if (fetchedData.selectedData !== undefined) {
                        console.log('Selected data:', fetchedData.selectedData);
                        setSelectedDataState(fetchedData.selectedData || []);
                    }
                    if (fetchedData.dataFilters !== undefined)
                        setDataFiltersState(fetchedData.dataFilters || {});
                    if (fetchedData.isLocked !== undefined)
                        setIsLockedState(fetchedData.isLocked || false);
                } catch (error) {
                    console.error('Error fetching collection context:', JSON.stringify(error));
                }
            })();
        }
    }, [location.pathname]);

    const value: ICollectionContext = {
        type,
        metadata,
        dataset,
        datasetId,
        modeInput,
        selectedData,
        dataFilters,
        isLocked,
        setType,
        setModeInput,
        setSelectedData,
        setDataFilters,
        setIsLocked,
        setDatasetId,
        updateContext,
        resetContext,
        metadataDispatch: async (action: MetadataAction) => {
            const data = await saveCollectionContext('metadataDispatch', { action });
            if (data.metadata) setMetadataState(data.metadata);
            return data;
        },
        datasetDispatch: async (action: DataAction) => {
            const data = await saveCollectionContext('datasetDispatch', { action });
            if (data.dataset) setDatasetState(data.dataset);
            return data;
        }
    };

    return <CollectionContext.Provider value={value}>{children}</CollectionContext.Provider>;
};

export const useCollectionContext = () => {
    const context = useContext(CollectionContext);
    if (!context) {
        throw new Error('useCollectionContext must be used within a CollectionProvider');
    }
    return context;
};

import React, {
    createContext,
    useReducer,
    useState,
    useEffect,
    useMemo,
    useContext,
    FC
} from 'react';
import { v4 } from 'uuid';
import { SetState } from '../types/Coding/shared';
import { ILayout } from '../types/Coding/shared';

// Mode type for context
export type ModeType = 'reddit' | 'interview' | null;

// ----- Metadata Types -----
// Both metadata types include a discriminant property "type"
export interface RedditMetadata {
    type: 'reddit';
    source: 'folder' | 'url'; // same as currentMode
    subreddit: string;
}

export interface InterviewMetadata {
    type: 'interview';
    source: 'folder'; // Only folder is allowed for interview
}

export type MetadataState = RedditMetadata | InterviewMetadata | null;

// ----- Dataset Types -----
export type RedditData = any;
export type InterviewData = any;
export type Dataset = RedditData[] | InterviewData[];

// ----- Actions for Dataset and Metadata -----

// Dataset actions
export type DataAction =
    | { type: 'ADD_DATA'; payload: RedditData | InterviewData }
    | { type: 'RESET_DATA' };

const datasetReducer = (
    state: (RedditData | InterviewData)[],
    action: DataAction
): (RedditData | InterviewData)[] => {
    switch (action.type) {
        case 'ADD_DATA':
            return [...state, action.payload];
        case 'RESET_DATA':
            return [];
        default:
            return state;
    }
};

// Metadata actions
export type MetadataAction =
    | { type: 'SET_SOURCE'; payload: 'folder' | 'url' }
    | { type: 'SET_SUBREDDIT'; payload: string }
    | { type: 'RESET_METADATA' };

const metadataReducer = (state: MetadataState, action: MetadataAction): MetadataState => {
    if (!state) {
        return null;
    }
    switch (action.type) {
        case 'SET_SOURCE':
            return { ...state, source: action.payload } as MetadataState;
        case 'SET_SUBREDDIT':
            // Only applies if state is RedditMetadata.
            if (state.type === 'reddit') {
                return { ...state, subreddit: action.payload };
            }
            return state;
        case 'RESET_METADATA':
            // Return default values based on the type.
            return state.type === 'reddit'
                ? { type: 'reddit', source: 'folder', subreddit: '' }
                : { type: 'interview', source: 'folder' };
        default:
            return state;
    }
};

// ====================================================
// Context Interface
// ====================================================

export interface ExtendedICollectionContext {
    type: ModeType;
    metadata: MetadataState;
    dataset: Dataset;
    datasetId: string;
    modeInput: string;
    selectedData: string[];
    dataFilters: Record<string, any>;
    setDataFilters: SetState<Record<string, any>>;
    datasetDispatch: React.Dispatch<DataAction>;
    setDatasetId: SetState<string>;
    setModeInput: SetState<string>;
    metadataDispatch: React.Dispatch<MetadataAction>;
    setType: SetState<ModeType>;
    setSelectedData: SetState<string[]>;
    updateContext: (updates: Partial<ExtendedICollectionContext>) => void;
    resetContext: () => void;
}

// ====================================================
// Default Initial States
// ====================================================

const defaultRedditMetadata: RedditMetadata = {
    type: 'reddit',
    source: 'folder',
    subreddit: ''
};

const defaultInterviewMetadata: InterviewMetadata = {
    type: 'interview',
    source: 'folder'
};

const defaultContext: ExtendedICollectionContext = {
    type: 'reddit',
    metadata: defaultRedditMetadata,
    dataset: [],
    datasetId: '',
    modeInput: '',
    selectedData: [],
    dataFilters: {},
    setDataFilters: () => {},
    datasetDispatch: () => {},
    setDatasetId: () => {},
    setModeInput: () => {},
    metadataDispatch: () => {},
    setType: () => {},
    setSelectedData: () => {},
    updateContext: () => {},
    resetContext: () => {}
};

// ====================================================
// Context & Provider
// ====================================================

export const CollectionContext = createContext<ExtendedICollectionContext>(defaultContext);

export const CollectionProvider: FC<ILayout> = ({ children }) => {
    // Manage the "type" (reddit or interview)
    const [type, setType] = useState<ModeType>(null);

    // Manage metadata: initially based on the type
    const [metadata, metadataDispatch] = useReducer(
        metadataReducer,
        type === 'reddit'
            ? defaultRedditMetadata
            : type === 'interview'
              ? defaultInterviewMetadata
              : null
    );

    // Manage dataset as an array
    const [dataset, datasetDispatch] = useReducer(datasetReducer, []);

    // Other states
    const [datasetId, setDatasetId] = useState<string>(v4());
    const [modeInput, setModeInput] = useState<string>('');
    const [selectedData, setSelectedData] = useState<string[]>([]);
    const [dataFilters, setDataFilters] = useState<Record<string, any>>({});

    // When switching type, reset metadata to the proper default.
    useEffect(() => {
        if (type === 'reddit') {
            metadataDispatch({ type: 'RESET_METADATA' });
            metadataDispatch({ type: 'SET_SOURCE', payload: 'folder' });
            metadataDispatch({ type: 'SET_SUBREDDIT', payload: '' });
        } else {
            metadataDispatch({ type: 'RESET_METADATA' });
        }
    }, [type]);

    // updateContext: Update multiple parts of the context.
    const updateContext = (updates: Partial<ExtendedICollectionContext>) => {
        console.log('Updates:', updates);
        if (updates.type !== undefined) {
            setType(updates.type);
        }
        if (updates.metadata !== undefined && updates.metadata !== null) {
            if (updates.metadata.source !== undefined) {
                metadataDispatch({ type: 'SET_SOURCE', payload: updates.metadata.source });
            }
            if (
                updates.metadata &&
                'subreddit' in updates.metadata &&
                updates.metadata.subreddit !== undefined
            ) {
                metadataDispatch({ type: 'SET_SUBREDDIT', payload: updates.metadata.subreddit });
            }
        }
        if (updates.datasetId !== undefined) {
            setDatasetId(updates.datasetId);
        }
        if (updates.modeInput !== undefined) {
            setModeInput(updates.modeInput);
        }
        if (updates.selectedData !== undefined) {
            setSelectedData(updates.selectedData);
        }
    };

    // resetContext: Reset context to its default values.
    const resetContext = () => {
        setType('reddit');
        metadataDispatch({ type: 'RESET_METADATA' });
        datasetDispatch({ type: 'RESET_DATA' });
        setDatasetId(v4());
        setModeInput('');
        setSelectedData([]);
        setDataFilters({});
    };

    useEffect(() => {
        console.log('data filters', dataFilters);
    }, [dataFilters]);

    const value = useMemo(
        () => ({
            type,
            metadata,
            dataset,
            datasetId,
            modeInput,
            selectedData,
            dataFilters,
            setDataFilters,
            datasetDispatch,
            setDatasetId,
            setModeInput,
            metadataDispatch,
            setType,
            setSelectedData,
            updateContext,
            resetContext
        }),
        [type, metadata, dataset, datasetId, modeInput, selectedData, dataFilters]
    );

    return <CollectionContext.Provider value={value}>{children}</CollectionContext.Provider>;
};

export const useCollectionContext = () => useContext(CollectionContext);

import {
    createContext,
    useState,
    FC,
    Dispatch,
    useCallback,
    useReducer,
    useEffect,
    useContext
} from 'react';
import { useMemo } from 'react';
import { ILayout, Mode, SetState } from '../types/Coding/shared';
import { v4 } from 'uuid';

export interface ICollectionContext {
    currentMode: Mode;
    toggleMode: () => void;
    modeInput: string;
    setModeInput: SetState<string>;
    subreddit: string;
    setSubreddit: SetState<string>;
    selectedPosts: string[];
    setSelectedPosts: SetState<string[]>;
    datasetId: string;
    setDatasetId: SetState<string>;
    updateContext: (updates: Partial<ICollectionContext>) => void;
    resetContext: () => void;
}

// Create the context
export const CollectionContext = createContext<ICollectionContext>({
    currentMode: 'folder',
    modeInput: '',
    toggleMode: () => {},
    setModeInput: () => {},
    subreddit: '',
    setSubreddit: () => {},
    selectedPosts: [],
    setSelectedPosts: () => {},
    datasetId: '',
    setDatasetId: () => {},
    updateContext: () => {},
    resetContext: () => {}
});

// Create a provider component
export const CollectionProvider: FC<ILayout> = ({ children }) => {
    const [currentMode, setCurrentMode] = useState<Mode>('folder');
    const [modeInput, setModeInput] = useState<string>('');
    const [subreddit, setSubreddit] = useState<string>('');
    const [selectedPosts, setSelectedPosts] = useState<string[]>([
        // '1019969',
        // '1069046',
        // '1076923',
        // '1093101',
        // '1141939',
        // '1145299',
        // '1193887',
        // '1194945',
        // '1253598',
        // '1254667'
    ]);

    const [datasetId, setDatasetId] = useState<string>(v4());

    const toggleMode = useCallback(() => {
        setCurrentMode((prevMode: Mode) => {
            setModeInput('');
            return prevMode === 'link' ? 'folder' : 'link';
        });
    }, []);

    // Function to update context state
    const updateContext = (updates: Partial<ICollectionContext>) => {
        if (updates.currentMode !== undefined) setCurrentMode(updates.currentMode);
        if (updates.modeInput !== undefined) setModeInput(updates.modeInput);
        if (updates.subreddit !== undefined) setSubreddit(updates.subreddit);
        if (updates.selectedPosts !== undefined) setSelectedPosts(updates.selectedPosts);
        if (updates.datasetId !== undefined) setDatasetId(updates.datasetId || v4());
    };

    const resetContext = () => {
        setCurrentMode('folder');
        setModeInput('');
        setSubreddit('');
        setSelectedPosts([]);
        setDatasetId(v4());
    };

    useEffect(() => {
        console.log('In dc', datasetId);
    }, [datasetId]);

    const value = useMemo(
        () => ({
            currentMode,
            toggleMode,
            modeInput,
            setModeInput,
            subreddit,
            setSubreddit,
            selectedPosts,
            setSelectedPosts,
            datasetId,
            setDatasetId,
            updateContext,
            resetContext
        }),
        [currentMode, modeInput, selectedPosts, subreddit, datasetId]
    );

    return <CollectionContext.Provider value={value}>{children}</CollectionContext.Provider>;
};

export const useCollectionContext = () => useContext(CollectionContext);

import { createContext, useState, FC, Dispatch, useCallback, useReducer, useEffect, useContext } from 'react';
import { useMemo } from 'react';
import {
    ILayout,
    Mode,
    SetState,
} from '../types/Coding/shared';

interface ICollectionContext {
    currentMode: Mode;
    toggleMode: () => void;
    modeInput: string;
    setModeInput: SetState<string>;
    subreddit: string;
    setSubreddit: SetState<string>;
    selectedPosts: string[];
    setSelectedPosts: SetState<string[]>;
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

    const toggleMode = useCallback(() => {
        setCurrentMode((prevMode: Mode) => {
            setModeInput('');
            return prevMode === 'link' ? 'folder' : 'link';
        });
    }, []);

    useEffect(() => {
        console.log('In dc', currentMode, modeInput);
    }, [currentMode, modeInput]);

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
        }),
        [
            currentMode,
            modeInput,
            selectedPosts,
            subreddit,
        ]
    );

    return <CollectionContext.Provider value={value}>{children}</CollectionContext.Provider>;
};

export const useCollectionContext = () => useContext(CollectionContext);
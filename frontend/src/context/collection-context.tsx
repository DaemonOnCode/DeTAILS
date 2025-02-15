import { createContext, useState, FC, useCallback, useContext } from 'react';
import { useMemo } from 'react';
import { ILayout, Mode } from '../types/Coding/shared';
import { v4 } from 'uuid';
import { ICollectionContext } from '../types/Shared';

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
    resetContext: () => {},
    interviewInput: '',
    setInterviewInput: () => {}
});

export const CollectionProvider: FC<ILayout> = ({ children }) => {
    const [currentMode, setCurrentMode] = useState<Mode>('folder');
    const [modeInput, setModeInput] = useState<string>('');
    const [subreddit, setSubreddit] = useState<string>('');
    const [selectedPosts, setSelectedPosts] = useState<string[]>([]);

    const [interviewInput, setInterviewInput] = useState<string>('');

    const [datasetId, setDatasetId] = useState<string>(v4());

    const toggleMode = useCallback(() => {
        setCurrentMode((prevMode: Mode) => {
            setModeInput('');
            return prevMode === 'link' ? 'folder' : 'link';
        });
    }, []);

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

    const value = useMemo(
        () => ({
            currentMode,
            toggleMode,
            modeInput,
            setModeInput,
            interviewInput,
            setInterviewInput,
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

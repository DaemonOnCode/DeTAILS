// import {
//     createContext,
//     useState,
//     FC,
//     Dispatch,
//     useCallback,
//     useReducer,
//     useEffect,
//     useContext
// } from 'react';
// import { useMemo } from 'react';
// import { ILayout, Mode, SetState } from '../types/Coding/shared';
// import { v4 } from 'uuid';
// import { ICollectionContext } from '../types/Shared';

// export const CollectionContext = createContext<ICollectionContext>({
//     currentMode: 'folder',
//     modeInput: '',
//     toggleMode: () => {},
//     setModeInput: () => {},
//     subreddit: '',
//     setSubreddit: () => {},
//     selectedPosts: [],
//     setSelectedPosts: () => {},
//     datasetId: '',
//     setDatasetId: () => {},
//     updateContext: () => {},
//     resetContext: () => {},
//     interviewInput: '',
//     setInterviewInput: () => {}
// });

// export const CollectionProvider: FC<ILayout> = ({ children }) => {
//     const [currentMode, setCurrentMode] = useState<Mode>('folder');
//     const [modeInput, setModeInput] = useState<string>('');
//     const [subreddit, setSubreddit] = useState<string>('');
//     const [selectedPosts, setSelectedPosts] = useState<string[]>([]);

//     const [interviewInput, setInterviewInput] = useState<string>('');

//     const [datasetId, setDatasetId] = useState<string>(v4());

//     const toggleMode = useCallback(() => {
//         setCurrentMode((prevMode: Mode) => {
//             setModeInput('');
//             return prevMode === 'link' ? 'folder' : 'link';
//         });
//     }, []);

//     const updateContext = (updates: Partial<ICollectionContext>) => {
//         if (updates.currentMode !== undefined) setCurrentMode(updates.currentMode);
//         if (updates.modeInput !== undefined) setModeInput(updates.modeInput);
//         if (updates.subreddit !== undefined) setSubreddit(updates.subreddit);
//         if (updates.selectedPosts !== undefined) setSelectedPosts(updates.selectedPosts);
//         if (updates.datasetId !== undefined) setDatasetId(updates.datasetId || v4());
//     };

//     const resetContext = () => {
//         setCurrentMode('folder');
//         setModeInput('');
//         setSubreddit('');
//         setSelectedPosts([]);
//         setDatasetId(v4());
//     };

//     const value = useMemo(
//         () => ({
//             currentMode,
//             toggleMode,
//             modeInput,
//             setModeInput,
//             interviewInput,
//             setInterviewInput,
//             subreddit,
//             setSubreddit,
//             selectedPosts,
//             setSelectedPosts,
//             datasetId,
//             setDatasetId,
//             updateContext,
//             resetContext
//         }),
//         [currentMode, modeInput, selectedPosts, subreddit, datasetId]
//     );

//     return <CollectionContext.Provider value={value}>{children}</CollectionContext.Provider>;
// };

// export const useCollectionContext = () => useContext(CollectionContext);

import React, {
    createContext,
    useReducer,
    useState,
    useCallback,
    useContext,
    useMemo,
    FC
} from 'react';
import { v4 } from 'uuid';
import { ILayout, Mode, SetState } from '../types/Coding/shared';
import { ICollectionContext } from '../types/Shared';

/* ====================================================
   Provided Types
   ==================================================== */

// Provided Reddit data type remains unchanged.
type IRedditData = {
    currentMode: Mode;
    modeInput: string;
    subreddit: string;
};

// Updated Interview data type now holds an array of strings.
type IInterviewData = {
    interviewInput: string[];
};

/* ====================================================
   Common Data State as a Union
   ==================================================== */

// Define the union exactly as specified.
export type DataState =
    | {
          type: 'reddit';
          state: IRedditData;
      }
    | {
          type: 'interview';
          state: IInterviewData;
      };

const defaultRedditData: IRedditData = {
    currentMode: 'folder',
    modeInput: '',
    subreddit: ''
};

const defaultInterviewData: IInterviewData = {
    interviewInput: []
};

const defaultCommonData: DataState = {
    type: 'reddit',
    state: defaultRedditData
};

/* ====================================================
   Reducer & Actions
   ==================================================== */

// Define actions for updating the common data.
type DataAction =
    | { type: 'SET_REDDIT_DATA'; payload: Partial<IRedditData> }
    | { type: 'SET_INTERVIEW_DATA'; payload: Partial<IInterviewData> }
    | { type: 'RESET_DATA' };

const dataReducer = (state: DataState, action: DataAction): DataState => {
    switch (action.type) {
        case 'SET_REDDIT_DATA': {
            // Merge with current reddit data if already in reddit mode,
            // otherwise start with default values.
            const newReddit =
                state.type === 'reddit'
                    ? { ...state.state, ...action.payload }
                    : { ...defaultRedditData, ...action.payload };
            return { type: 'reddit', state: newReddit };
        }
        case 'SET_INTERVIEW_DATA': {
            // Merge with current interview data if already in interview mode,
            // otherwise start with default values.
            const newInterview =
                state.type === 'interview'
                    ? { ...state.state, ...action.payload }
                    : { ...defaultInterviewData, ...action.payload };
            return { type: 'interview', state: newInterview };
        }
        case 'RESET_DATA':
            return defaultCommonData;
        default:
            return state;
    }
};

/* ====================================================
   Context Setup
   ==================================================== */

// Extend your ICollectionContext to include our common data.
export interface ExtendedICollectionContext extends ICollectionContext {
    // Expose the common data state (which is either Reddit or Interview).
    datasetState: DataState;
    datasetDispatch: React.Dispatch<DataAction>;
}

// Provide a default value for the context.
export const CollectionContext = createContext<ExtendedICollectionContext>({
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
    interviewInput: [],
    setInterviewInput: () => {},
    // Expose our common data.
    datasetState: defaultCommonData,
    datasetDispatch: () => {}
});

/* ====================================================
   Provider Component
   ==================================================== */

export const CollectionProvider: FC<ILayout> = ({ children }) => {
    // Other (non‑data) state managed with useState.
    const [currentMode, setCurrentMode] = useState<Mode>('folder');
    const [modeInput, setModeInput] = useState<string>('');
    const [datasetId, setDatasetId] = useState<string>(v4());

    const [selectedPosts, setSelectedPosts] = useState<string[]>([]);
    const [interviewInput, setInterviewInput] = useState<string[]>([]);

    // Manage the common data state with useReducer.
    const [datasetState, datasetDispatch] = useReducer(dataReducer, defaultCommonData);

    const toggleMode = useCallback(() => {
        setCurrentMode((prevMode) => {
            setModeInput('');
            return prevMode === 'link' ? 'folder' : 'link';
        });
    }, []);

    const updateContext = (updates: Partial<ICollectionContext>) => {
        if (updates.currentMode !== undefined) setCurrentMode(updates.currentMode);
        if (updates.modeInput !== undefined) setModeInput(updates.modeInput);
        if (updates.datasetId !== undefined) setDatasetId(updates.datasetId || v4());
        if (updates.subreddit !== undefined) {
            datasetDispatch({ type: 'SET_REDDIT_DATA', payload: { subreddit: updates.subreddit } });
        }
        if (updates.selectedPosts !== undefined) {
            setSelectedPosts(updates.selectedPosts);
        }
        if (updates.interviewInput !== undefined) {
            // For interview data, we now expect an array of strings.
            datasetDispatch({
                type: 'SET_INTERVIEW_DATA',
                payload: { interviewInput: updates.interviewInput as any }
            });
        }
    };

    const resetContext = () => {
        setCurrentMode('folder');
        setModeInput('');
        setDatasetId(v4());
        datasetDispatch({ type: 'RESET_DATA' });
    };

    // Legacy setters (if needed) can remain for backward compatibility.
    const setSubreddit: any = (subreddit: string) => {
        datasetDispatch({ type: 'SET_REDDIT_DATA', payload: { subreddit } });
    };

    const value = useMemo(
        () => ({
            currentMode,
            toggleMode,
            modeInput,
            setModeInput,
            // Legacy getters (optional)
            subreddit: datasetState.type === 'reddit' ? datasetState.state.subreddit : '',
            setSubreddit,
            selectedPosts,
            setSelectedPosts,
            datasetId,
            setDatasetId,
            updateContext,
            resetContext,
            // For interview data, expose an array
            interviewInput,
            setInterviewInput,
            // Expose the entire common data state.
            datasetState,
            datasetDispatch
        }),
        [currentMode, modeInput, datasetId, datasetState]
    );

    return <CollectionContext.Provider value={value}>{children}</CollectionContext.Provider>;
};

export const useCollectionContext = () => useContext(CollectionContext);

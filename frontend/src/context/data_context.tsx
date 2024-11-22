import { createContext, useState, FC, Dispatch, useCallback, useReducer, useEffect } from 'react';
import { useMemo } from 'react';
import {
    IFinalCodeResponse,
    IFile,
    ILayout,
    ISentenceBox,
    Mode,
    SetState,
    IReference
} from '../types/shared';

interface IDataContext {
    currentMode: Mode;
    toggleMode: () => void;
    modeInput: string;
    setModeInput: SetState<string>;
    subreddit: string;
    setSubreddit: SetState<string>;
    selectedPosts: string[];
    setSelectedPosts: SetState<string[]>;
    basisFiles: IFile;
    addBasisFile: (filePath: string, fileName: string) => void;
    removeBasisFile: (filePath: string) => void;
    mainCode: string;
    setMainCode: SetState<string>;
    additionalInfo?: string;
    setAdditionalInfo: SetState<string>;
    flashcards: {
        id: number;
        question: string;
        answer: string;
    }[];
    addFlashcard: (question: string, answer: string) => void;
    removeFlashcard: (id: number) => void;
    selectedFlashcards: number[];
    selectFlashcard: (id: number) => void;
    deselectFlashcard: (id: number) => void;
    words: string[];
    setWords: SetState<string[]>;
    selectedWords: string[];
    setSelectedWords: SetState<string[]>;
    references: {
        [code: string]: IReference[];
    };
    setReferences: SetState<{
        [code: string]: IReference[];
    }>;
    codeResponses: ISentenceBox[];
    dispatchCodeResponses: Dispatch<any>;
    finalCodeResponses: IFinalCodeResponse[];
    dispatchFinalCodeResponses: Dispatch<any>;
}

// Create the context
export const DataContext = createContext<IDataContext>({
    currentMode: 'folder',
    modeInput: '',
    toggleMode: () => {},
    setModeInput: () => {},
    subreddit: '',
    setSubreddit: () => {},
    selectedPosts: [],
    setSelectedPosts: () => {},
    basisFiles: {},
    addBasisFile: () => {},
    removeBasisFile: () => {},
    mainCode: '',
    setMainCode: () => {},
    additionalInfo: '',
    setAdditionalInfo: () => {},
    flashcards: [],
    addFlashcard: () => {},
    removeFlashcard: () => {},
    selectedFlashcards: [],
    selectFlashcard: () => {},
    deselectFlashcard: () => {},
    words: [],
    setWords: () => {},
    selectedWords: [],
    setSelectedWords: () => {},
    references: {},
    setReferences: () => {},
    codeResponses: [],
    dispatchCodeResponses: () => {},
    finalCodeResponses: [],
    dispatchFinalCodeResponses: () => {}
});

type Action<T> =
    | { type: 'SET_CORRECT'; index: number }
    | { type: 'SET_ALL_CORRECT' }
    | { type: 'SET_INCORRECT'; index: number }
    | { type: 'SET_ALL_INCORRECT' }
    | { type: 'UPDATE_COMMENT'; index: number; comment: string }
    | { type: 'MARK_RESPONSE'; index: number; isMarked?: boolean }
    | { type: 'RERUN_CODING'; indexes: number[]; newResponses: T[] }
    | {
          type: 'ADD_RESPONSE';
          response: T;
      }
    | { type: 'ADD_RESPONSES'; responses: T[] }
    | (
          | { type: 'REMOVE_RESPONSES'; indexes: number[]; all?: never }
          | { type: 'REMOVE_RESPONSES'; all: boolean; indexes?: never }
      )
    | { type: 'SET_ALL_UNMARKED' }
    | { type: 'SET_RESPONSES'; responses: T[] };

// Reducer function to manage the state of responses
function codeResponsesReducer<T>(state: T[], action: Action<T>): T[] {
    console.log('Action:', action);
    switch (action.type) {
        case 'SET_CORRECT':
            return state.map((response, index) =>
                index === action.index ? { ...response, isCorrect: true, comment: '' } : response
            );
        case 'SET_ALL_CORRECT':
            return [...state.map((response) => ({ ...response, isMarked: true }))];
        case 'SET_INCORRECT':
            return state.map((response, index) =>
                index === action.index ? { ...response, isCorrect: false } : response
            );
        case 'SET_ALL_INCORRECT':
            return [...state.map((response) => ({ ...response, isMarked: false }))];
        case 'SET_ALL_UNMARKED':
            return [...state.map((response) => ({ ...response, isMarked: undefined }))];
        case 'UPDATE_COMMENT':
            return state.map((response, index) =>
                index === action.index ? { ...response, comment: action.comment } : response
            );
        case 'MARK_RESPONSE':
            return state.map((response, index) =>
                index === action.index ? { ...response, isMarked: action.isMarked } : response
            );
        case 'RERUN_CODING':
            return state
                .filter((_, index) => !action.indexes.includes(index))
                .concat(action.newResponses);
        case 'ADD_RESPONSE':
            return state.concat({
                ...action.response
            });
        case 'SET_RESPONSES':
            return [...action.responses];
        case 'ADD_RESPONSES':
            return [...state, ...action.responses];
        case 'REMOVE_RESPONSES':
            if (action.all) {
                return [];
            }
            if (action.indexes) {
                return state.filter((_, index) => !action.indexes!.includes(index));
            }
            return state;
        default:
            return state;
    }
}

// Create a provider component
export const DataProvider: FC<ILayout> = ({ children }) => {
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
    const [basisFiles, setBasisFiles] = useState<IFile>({});
    const [mainCode, setMainCode] = useState<string>('');
    // 'Student life';
    const [additionalInfo, setAdditionalInfo] = useState<string>('');
    // 'Daily activities of students';
    const [flashcards, setFlashcards] = useState<
        {
            id: number;
            question: string;
            answer: string;
        }[]
    >([]);
    // initialFlashcards.map((flashcard, index) => ({ id: index, ...flashcard }))
    const [selectedFlashcards, setSelectedFlashcards] = useState<number[]>([
        // 0, 1, 2, 3, 4, 5, 6, 7, 8, 9
    ]);
    const [words, setWords] = useState<string[]>([]);
    // initialWords
    const [selectedWords, setSelectedWords] = useState<string[]>([]);
    // initialWords.slice(0, 10)

    const [references, setReferences] = useState<{
        [code: string]: IReference[];
    }>({});

    const [codeResponses, dispatchCodeResponses] = useReducer(
        codeResponsesReducer<ISentenceBox>,
        []
    );

    const [finalCodeResponses, dispatchFinalCodeResponses] = useReducer(
        codeResponsesReducer<IFinalCodeResponse>,
        []
    );

    const toggleMode = useCallback(() => {
        setCurrentMode((prevMode: Mode) => {
            setModeInput('');
            return prevMode === 'link' ? 'folder' : 'link';
        });
    }, []);

    const addBasisFile = useCallback((filePath: string, fileName: string) => {
        setBasisFiles((prevFiles) => ({ ...prevFiles, [filePath]: fileName }));
    }, []);

    const removeBasisFile = useCallback((filePath: string) => {
        setBasisFiles((prevFiles) => {
            const newFiles = { ...prevFiles };
            delete newFiles[filePath];
            return newFiles;
        });
    }, []);

    const addFlashcard = useCallback((question: string, answer: string) => {
        setFlashcards((prevFlashcards) => {
            if (prevFlashcards.length === 0) return [{ id: 1, question, answer }];
            const lastFlashcard = prevFlashcards[prevFlashcards.length - 1];
            const newId = lastFlashcard.id + 1;
            return [...prevFlashcards, { id: newId, question, answer }];
        });
    }, []);

    const removeFlashcard = useCallback((id: number) => {
        setFlashcards((prevFlashcards) =>
            prevFlashcards.filter((flashcard) => flashcard.id !== id)
        );
    }, []);

    const selectFlashcard = useCallback((id: number) => {
        setSelectedFlashcards((prevFlashcards) => [...prevFlashcards, id]);
    }, []);

    const deselectFlashcard = useCallback((id: number) => {
        setSelectedFlashcards((prevFlashcards) =>
            prevFlashcards.filter((flashcardId) => flashcardId !== id)
        );
    }, []);

    useEffect(() => {
        setSelectedWords([mainCode]);
    }, [mainCode]);

    useEffect(() => {
        dispatchFinalCodeResponses({
            type: 'SET_RESPONSES',
            responses: codeResponses
                .filter((response) => response.isMarked === true)
                .map((response) => {
                    return {
                        postId: response.postId,
                        sentence: response.sentence,
                        coded_word: response.coded_word,
                        reasoning: response.reasoning
                    };
                })
        });
    }, [codeResponses]);

    const value = useMemo(
        () => ({
            currentMode,
            toggleMode,
            modeInput,
            setModeInput,
            subreddit,
            setSubreddit,
            basisFiles,
            addBasisFile,
            removeBasisFile,
            selectedPosts,
            setSelectedPosts,
            mainCode,
            setMainCode,
            additionalInfo,
            setAdditionalInfo,
            flashcards,
            addFlashcard,
            removeFlashcard,
            selectedFlashcards,
            selectFlashcard,
            deselectFlashcard,
            words,
            setWords,
            selectedWords,
            setSelectedWords,
            references,
            setReferences,
            codeResponses,
            dispatchCodeResponses,
            finalCodeResponses,
            dispatchFinalCodeResponses
        }),
        [
            currentMode,
            modeInput,
            selectedPosts,
            subreddit,
            basisFiles,
            mainCode,
            additionalInfo,
            flashcards,
            selectedFlashcards,
            words,
            selectedWords,
            references,
            codeResponses,
            finalCodeResponses
        ]
    );

    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

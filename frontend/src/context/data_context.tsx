import { createContext, useState, FC, useEffect, useCallback } from 'react';
import { useMemo } from 'react';
import { IFile, ILayout, Mode, SetState } from '../types/shared';
import { initialWords } from '../constants/shared';

interface IDataContext {
    currentMode: Mode;
    toggleMode: () => void;
    modeInput: string;
    setModeInput: SetState<string>;
    selectedPosts: Set<string>;
    setSelectedPosts: SetState<Set<string>>;
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
}

// Create the context
export const DataContext = createContext<IDataContext>({
    currentMode: 'folder',
    modeInput: '',
    toggleMode: () => {},
    setModeInput: () => {},
    selectedPosts: new Set(),
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
    setSelectedWords: () => {}
});

// Create a provider component

export const DataProvider: FC<ILayout> = ({ children }) => {
    const [currentMode, setCurrentMode] = useState<Mode>('folder');
    const [modeInput, setModeInput] = useState<string>('');
    const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set());
    const [basisFiles, setBasisFiles] = useState<IFile>({});
    const [mainCode, setMainCode] = useState<string>('C++');
    const [additionalInfo, setAdditionalInfo] = useState<string>('It is a programming language.');
    const [flashcards, setFlashcards] = useState<
        {
            id: number;
            question: string;
            answer: string;
        }[]
    >([]);
    const [selectedFlashcards, setSelectedFlashcards] = useState<number[]>([]);
    const [words, setWords] = useState<string[]>(initialWords);
    const [selectedWords, setSelectedWords] = useState<string[]>([]);

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

    const value = useMemo(
        () => ({
            currentMode,
            toggleMode,
            modeInput,
            setModeInput,
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
            setSelectedWords
        }),
        [
            currentMode,
            modeInput,
            selectedPosts,
            basisFiles,
            mainCode,
            additionalInfo,
            flashcards,
            selectedFlashcards,
            words,
            selectedWords
        ]
    );

    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

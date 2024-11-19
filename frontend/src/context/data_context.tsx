import { createContext, useState, FC, useEffect } from 'react';
import { IFile, ILayout, Mode, SetState } from '../types/shared';
import { initialFlashcards, initialWords } from '../constants/shared';

interface IDataContext {
    mainWord: string;
    currentMode: Mode;
    toggleMode: () => void;
    modeInput: string;
    setModeInput: SetState<string>;
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
    mainWord: '',
    currentMode: 'folder',
    modeInput: '',
    toggleMode: () => {},
    setModeInput: () => {},
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
    const mainWord = 'React';
    const [currentMode, setCurrentMode] = useState<Mode>('folder');

    const [modeInput, setModeInput] = useState<string>('');

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
    const [selectedWords, setSelectedWords] = useState<string[]>([mainWord]);

    const toggleMode = () => {
        setCurrentMode((prevMode: Mode) => {
            setModeInput('');
            return prevMode === 'link' ? 'folder' : 'link';
        });
    };

    useEffect(() => {
        console.log(currentMode, modeInput, mainCode, additionalInfo);
    }, [currentMode, modeInput, mainCode, additionalInfo]);

    useEffect(() => {
        console.log(basisFiles);
    }, [basisFiles]);

    const addBasisFile = (filePath: string, fileName: string) => {
        setBasisFiles((prevFiles) => {
            return { ...prevFiles, [filePath]: fileName };
        });
    };

    const removeBasisFile = (filePath: string) => {
        setBasisFiles((prevFiles) => {
            const newFiles = { ...prevFiles };
            delete newFiles[filePath];
            return newFiles;
        });
    };

    const addFlashcard = (question: string, answer: string) => {
        setFlashcards((prevFlashcards) => {
            if (prevFlashcards.length === 0) return [{ id: 1, question, answer }];
            const lastFlashcard = prevFlashcards[prevFlashcards.length - 1];
            let newId = lastFlashcard.id + 1;
            // const duplicateCheck =
            //     prevFlashcards.filter((flashcard) => flashcard.id === newId).length !== 0;
            // if (duplicateCheck) newId += 5;

            return [...prevFlashcards, { id: newId, question, answer }];
        });
    };

    const removeFlashcard = (id: number) => {
        setFlashcards((prevFlashcards) => {
            return prevFlashcards.filter((flashcard) => flashcard.id !== id);
        });
    };

    const selectFlashcard = (id: number) => {
        setSelectedFlashcards((prevFlashcards) => {
            return [...prevFlashcards, id];
        });
    };

    const deselectFlashcard = (id: number) => {
        setSelectedFlashcards((prevFlashcards) => {
            return prevFlashcards.filter((flashcardId) => flashcardId !== id);
        });
    };

    useEffect(() => {
        console.log(words, selectedWords);
    }, [words, selectedWords]);

    useEffect(() => {
        console.log(flashcards, selectedFlashcards);
    }, [flashcards, selectedFlashcards]);

    return (
        <DataContext.Provider
            value={{
                mainWord,
                currentMode,
                toggleMode,
                modeInput,
                setModeInput,
                addBasisFile,
                removeBasisFile,
                basisFiles,
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
            }}>
            {children}
        </DataContext.Provider>
    );
};

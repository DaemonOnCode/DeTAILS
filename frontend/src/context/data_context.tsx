import { createContext, useState, FC, useEffect } from "react";
import { IFile, ILayout, Mode, SetState } from "../types/shared";
import { initialWords } from "../constants/shared";

interface IDataContext {
    mainWord: string;
    currentMode: Mode;
    toggleMode: () => void,
    modeInput: string;
    setModeInput: SetState<string>;
    basisFiles: IFile;
    addBasisFile: (filePath: string, fileName: string) => void;
    removeBasisFile: (filePath: string) => void;
    searchText?: string;
    setSearchText: SetState<string>;
    words: string[];
    setWords: SetState<string[]>;
    selectedWords: string[];
    setSelectedWords: SetState<string[]>;
}



// Create the context
export const DataContext = createContext<IDataContext>({
    mainWord: "",
    currentMode: "folder",
    modeInput: "",
    toggleMode: () => {},
    setModeInput: () => {},
    basisFiles: {},
    addBasisFile: () => {},
    removeBasisFile: () => {},
    searchText: "",
    setSearchText: () => {},
    words: [],
    setWords: () => {},
    selectedWords: [],
    setSelectedWords: () => {}
});

// Create a provider component
export const DataProvider:FC<ILayout> = ({ children }) => {

    const mainWord = "React";
  const [currentMode, setCurrentMode] = useState<Mode>("folder");

  const [modeInput, setModeInput] = useState<string>("");

  const [basisFiles, setBasisFiles] = useState<IFile>({});

  const [searchText, setSearchText] = useState<string>("");

    const [words, setWords] = useState<string[]>(initialWords);
  const [selectedWords, setSelectedWords] = useState<string[]>([mainWord]);

  const toggleMode = () => {
		setCurrentMode((prevMode: Mode)=>{
			setModeInput("");
			return prevMode === "link" ? "folder" : "link";
		});
	};

    useEffect(() => {
        console.log(currentMode, modeInput, searchText);
    }, [currentMode, modeInput, searchText]);

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

    useEffect(() => {
        console.log(words, selectedWords);
    }, [words, selectedWords]);

  return (
    <DataContext.Provider value={{ 
        mainWord,
        currentMode,
        toggleMode, 
        modeInput, 
        setModeInput, 
        addBasisFile,
        removeBasisFile, 
        basisFiles, 
        searchText, 
        setSearchText,
        words,
        setWords,
        selectedWords,
        setSelectedWords
    }}>
      {children}
    </DataContext.Provider>
  );
};
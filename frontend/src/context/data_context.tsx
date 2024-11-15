import { createContext, useState, FC, useEffect } from "react";
import { IFile, ILayout, Mode } from "../types/shared";

interface IDataContext {
    currentMode: Mode;
    toggleMode: () => void,
    modeInput: string;
    setModeInput: (input: string) => void;
    basisFiles: IFile;
    addBasisFile: (filePath: string, fileName: string) => void;
    removeBasisFile: (filePath: string) => void;
    searchText?: string;
    setSearchText: (text: string) => void;
}



// Create the context
export const DataContext = createContext<IDataContext>({
    currentMode: "link",
    modeInput: "",
    toggleMode: () => {},
    setModeInput: () => {},
    basisFiles: {},
    addBasisFile: () => {},
    removeBasisFile: () => {},
    searchText: "",
    setSearchText: () => {},
});

// Create a provider component
export const DataProvider:FC<ILayout> = ({ children }) => {
  const [currentMode, setCurrentMode] = useState<Mode>("link");

  const [modeInput, setModeInput] = useState<string>("");

  const [basisFiles, setBasisFiles] = useState<IFile>({});

  const [searchText, setSearchText] = useState<string>("");

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

  return (
    <DataContext.Provider value={{ 
        currentMode,
        toggleMode, 
        modeInput, 
        setModeInput, 
        addBasisFile,
        removeBasisFile, 
        basisFiles, 
        searchText, 
        setSearchText 
    }}>
      {children}
    </DataContext.Provider>
  );
};
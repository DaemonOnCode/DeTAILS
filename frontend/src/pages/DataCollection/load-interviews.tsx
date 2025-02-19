import { FC, useEffect, useRef } from 'react';
import { useCollectionContext } from '../../context/collection-context';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';

// Access Electron and Node modules (ensure your Electron setup allows this)
const { ipcRenderer } = window.require('electron');
const fs = window.require('fs');

// Define a type for the interview file data.
export interface InterviewFile {
    type: 'text' | 'file';
    content: string;
}

const LoadInterview: FC = () => {
    // Retrieve context values.
    const { modeInput, setModeInput, type } = useCollectionContext();
    const { saveWorkspaceData } = useWorkspaceUtils();
    const hasSavedRef = useRef(false);

    useEffect(() => {
        // On unmount, save workspace data once.
        return () => {
            if (!hasSavedRef.current) {
                saveWorkspaceData();
                hasSavedRef.current = true;
            }
        };
    }, [saveWorkspaceData]);
    // Check if the current data type is interview.
    if (type !== 'interview') {
        return (
            <div className="flex flex-col p-4">
                <p className="text-red-500">
                    The loaded data is Reddit data. Please switch to Interview data from the home
                    page.
                </p>
            </div>
        );
    }

    const handleFileSelect = async () => {
        // Open file dialog for multiple file selection.
        const result: { fileName: string; filePath: string }[] =
            await ipcRenderer.invoke('select-files');
        console.log('Selected files:', result);

        // Map the result to an array of file paths.
        const filePaths: string[] = result.map((file) => file.filePath);

        // Process each file.
        const filesData: InterviewFile[] = await Promise.all(
            filePaths.map(async (filePath) => {
                const extension = filePath.split('.').pop()?.toLowerCase();
                if (extension === 'txt') {
                    // Read text files as UTF-8.
                    try {
                        const data = await fs.promises.readFile(filePath, 'utf8');
                        return { type: 'text', content: data };
                    } catch (err) {
                        console.error('Error reading file:', filePath, err);
                        return { type: 'text', content: '' };
                    }
                } else {
                    // For PDF or DOCX, store the file path for later processing.
                    return { type: 'file', content: filePath };
                }
            })
        );

        console.log('Files data:', filesData);
        // Update context by storing a JSON‑encoded version of the interview file array in modeInput.
        setModeInput(JSON.stringify(filesData));
    };

    // Data is considered loaded if modeInput is a non‑empty string.
    const isDataLoaded = modeInput && modeInput.length > 0;

    if (isDataLoaded) {
        return (
            <div className="flex flex-col p-4">
                {/* Optionally, decode modeInput to preview the files */}
                <p>Interview files loaded. You can now process them.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col">
            <header className="p-4">
                <h1 className="text-2xl font-bold mb-4">Upload Interview Files</h1>
            </header>
            <main className="flex-1 min-h-0 overflow-auto p-4">
                <button onClick={handleFileSelect} className="p-2 border border-gray-300 rounded">
                    Select Interview Files
                </button>
            </main>
        </div>
    );
};

export default LoadInterview;

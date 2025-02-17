import { FC, useEffect, useRef } from 'react';
import { useCollectionContext } from '../../context/collection-context';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';

// Access Electron and Node modules (ensure your Electron setup allows this)
const { ipcRenderer } = window.require('electron');
const fs = window.require('fs');

// Define a type for the interview file data.
interface InterviewFile {
    type: 'text' | 'file';
    content: string;
}

const LoadInterview: FC = () => {
    // Update the context type so interviewInput is an array of InterviewFile objects.
    const { interviewInput, setInterviewInput } = useCollectionContext();
    const { saveWorkspaceData } = useWorkspaceUtils();
    const hasSavedRef = useRef(false);

    useEffect(() => {
        // If interviewInput is available, further processing can be done here.
        return () => {
            if (!hasSavedRef.current) {
                saveWorkspaceData();
                hasSavedRef.current = true;
            }
        };
    }, [interviewInput, saveWorkspaceData]);

    const handleFileSelect = async () => {
        // Invoke the main process to open a file dialog that allows multiple file selection.
        const result: {
            fileName: string;
            filePath: string;
        }[] = await ipcRenderer.invoke('select-files');
        console.log('Selected files:', result);

        // if (result.canceled) return;
        const filePaths: string[] = result.map((file) => file.filePath);

        // Process each file.
        const filesData: InterviewFile[] = await Promise.all(
            filePaths.map(async (filePath) => {
                const extension = filePath.split('.').pop()?.toLowerCase();
                if (extension === 'txt') {
                    // For text files, read the file content as UTF-8.
                    try {
                        const data = await fs.promises.readFile(filePath, 'utf8');
                        return { type: 'text', content: data };
                    } catch (err) {
                        console.error('Error reading file:', filePath, err);
                        return { type: 'text', content: '' };
                    }
                } else {
                    // For PDF or DOCX files, store the file path for later processing.
                    return { type: 'file', content: filePath };
                }
            })
        );

        console.log('Files data:', filesData);
        // Update context with the array of interview files.
        // setInterviewInput(filesData);
    };

    // Data is loaded if interviewInput exists and contains at least one file.
    const isDataLoaded = Array.isArray(interviewInput) && interviewInput.length > 0;

    if (isDataLoaded) {
        return (
            <div className="flex flex-col h-page">
                {/* Render your interview data view here. For example: */}
                {/* <InterviewTableRenderer data={data} loading={loading} /> */}
            </div>
        );
    }

    return (
        <div className="flex flex-col h-page">
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

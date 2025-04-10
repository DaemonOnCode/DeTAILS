import { FC, useEffect, useRef, useState } from 'react';
import { useCollectionContext } from '../../context/collection-context';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import FileCard from '../../components/Coding/Shared/file-card';
import FileViewModal from '../Shared/file-view-modal';

const { ipcRenderer } = window.require('electron');

export interface InterviewFile {
    fileName: string;
    filePath: string;
}

const LoadInterview: FC = () => {
    // Retrieve context values.
    const { modeInput, setModeInput, type } = useCollectionContext();
    const { saveWorkspaceData } = useWorkspaceUtils();
    const hasSavedRef = useRef(false);

    // State to manage file view modal.
    const [fileViewModalOpen, setFileViewModalOpen] = useState(false);
    const [selectedFilePath, setSelectedFilePath] = useState('');

    useEffect(() => {
        // On unmount, save workspace data once.
        return () => {
            if (!hasSavedRef.current) {
                saveWorkspaceData();
                hasSavedRef.current = true;
            }
        };
    }, [saveWorkspaceData]);

    // If the current data type is not interview, show a warning.
    if (modeInput && type !== 'interview') {
        return (
            <div className="flex flex-col p-4">
                <p className="text-red-500">
                    The loaded data is Reddit data. Please switch to Reddit data.
                </p>
            </div>
        );
    }

    const handleFileSelect = async () => {
        // Invoke the Electron IPC method. Your main process returns an array
        // of objects each with fileName and filePath.
        const result: InterviewFile[] = await ipcRenderer.invoke('select-files');
        console.log('Selected files:', result);

        // If there are already files, append the new ones; otherwise, set the new list.
        let existingFiles: InterviewFile[] = [];
        if (modeInput && modeInput.startsWith('interview:')) {
            try {
                existingFiles = JSON.parse(modeInput.split('|').slice(1).join('|') ?? '');
            } catch (e) {
                console.error('Error parsing modeInput', e);
            }
        }
        const newFiles = [...existingFiles, ...result];
        setModeInput(`interview:${JSON.stringify(newFiles)}`);
    };

    // Handler to remove a file from the list.
    const handleRemoveFile = (filePath: string) => {
        try {
            const files = JSON.parse(
                modeInput.split('|').slice(1).join('|') ?? ''
            ) as InterviewFile[];
            const newFiles = files.filter((file) => file.filePath !== filePath);
            setModeInput(`interview:${JSON.stringify(newFiles)}`);
        } catch (e) {
            console.error('Error removing file', e);
        }
    };

    // When a file card is clicked, open the modal with the file.
    const handleRenderFile = (filePath: string) => {
        setSelectedFilePath(filePath);
        setFileViewModalOpen(true);
    };

    // Data is considered loaded if modeInput is a non‑empty string.
    const isDataLoaded = modeInput && modeInput.length > 0;

    return (
        <>
            {isDataLoaded ? (
                <section id="file-section" className="h-full w-full">
                    <h1 className="p-2 text-xl font-bold">Interview Files</h1>
                    <div className="flex flex-wrap gap-4 py-6 lg:py-10 justify-center items-center h-full flex-1 overflow-auto max-w-screen-sm lg:max-w-screen-lg mx-auto">
                        <label
                            className="flex items-center justify-center h-48 w-36 border rounded shadow-lg bg-white p-4 cursor-pointer text-blue-500 font-semibold hover:bg-blue-50"
                            onClick={handleFileSelect}>
                            <span>+ Add File</span>
                        </label>
                        {(() => {
                            let files: InterviewFile[] = [];
                            try {
                                files = JSON.parse(
                                    modeInput.split('|').slice(1).join('|') ?? ''
                                ) as InterviewFile[];
                            } catch (e) {
                                console.error('Error parsing modeInput', e);
                            }
                            return files.map((file) => (
                                <FileCard
                                    key={file.filePath}
                                    filePath={file.filePath}
                                    fileName={file.fileName}
                                    onRemove={handleRemoveFile}
                                    onClick={() => handleRenderFile(file.filePath)}
                                />
                            ));
                        })()}
                    </div>
                </section>
            ) : (
                <div className="flex flex-col h-full">
                    <header className="p-4">
                        <h1 className="text-2xl font-bold mb-4">Upload Interview Files</h1>
                    </header>
                    <main className="flex-1 min-h-0 overflow-auto p-4">
                        <button
                            onClick={handleFileSelect}
                            className="p-2 border border-gray-300 rounded">
                            Select Interview Files
                        </button>
                    </main>
                </div>
            )}
            {/* Render the FileViewModal if open */}
            {selectedFilePath !== '' && (
                <FileViewModal
                    filePath={selectedFilePath}
                    isViewOpen={selectedFilePath !== ''}
                    closeModal={() => {
                        setFileViewModalOpen(false);
                        setSelectedFilePath('');
                    }}
                />
            )}
        </>
    );
};

export default LoadInterview;

import { FC } from 'react';
import FileCard from '../../components/Coding/Shared/file-card';
import { InterviewFile } from '../../types/DataCollection/shared';

interface UploadInterviewFilesProps {
    localFiles: InterviewFile[];
    handleFileSelect: () => void;
    handleRemoveFile: (filePath: string) => void;
    handleRenderFile: (filePath: string) => void;
    handlePreprocess: () => void;
    isPreprocessing: boolean;
}

const UploadInterviewFiles: FC<UploadInterviewFilesProps> = ({
    localFiles,
    handleFileSelect,
    handleRemoveFile,
    handleRenderFile,
    handlePreprocess,
    isPreprocessing
}) => {
    return (
        <section className="flex flex-col h-full w-full p-6 bg-gray-50">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Upload Interview Files</h1>
                <button
                    onClick={handleFileSelect}
                    className="px-4 py-2 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600 transition duration-300 focus:outline-none focus:ring-2 focus:ring-blue-400">
                    + Add File
                </button>
            </div>
            <div className="flex-1 overflow-auto">
                {localFiles.length > 0 ? (
                    <div className="flex flex-wrap gap-6 justify-center p-4">
                        {localFiles.map((file) => (
                            <FileCard
                                key={file.filePath}
                                filePath={file.filePath}
                                fileName={file.fileName}
                                onRemove={handleRemoveFile}
                                onClick={() => handleRenderFile(file.filePath)}
                            />
                        ))}
                    </div>
                ) : (
                    <p className="text-gray-500 text-center mt-10">
                        No files added yet. Click “Add File” to start.
                    </p>
                )}
            </div>
            {localFiles.length > 0 && !isPreprocessing && (
                <div className="flex justify-center mt-6">
                    <button
                        onClick={handlePreprocess}
                        className="px-6 py-3 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600 transition duration-300 focus:outline-none focus:ring-2 focus:ring-green-400">
                        Preprocess
                    </button>
                </div>
            )}
            {isPreprocessing && (
                <div className="flex flex-col items-center justify-center mt-6">
                    <p className="text-gray-600">Preprocessing…</p>
                    <div className="w-8 h-8 border-4 border-t-blue-500 border-gray-200 rounded-full animate-spin mt-2" />
                </div>
            )}
        </section>
    );
};

export default UploadInterviewFiles;

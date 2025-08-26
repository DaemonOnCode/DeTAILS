import {
    FC,
    useEffect,
    useRef,
    useState,
    useCallback,
    RefObject,
    useImperativeHandle
} from 'react';
import { useCollectionContext } from '../../context/collection-context';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import FileViewModal from '../Shared/file-view-modal';
import UploadInterviewFiles from './upload-interview-files';
import AnonymizeInterviews from './anonymize-interviews';
import useInterviewData from '../../hooks/DataCollection/use-interview-data';
import { InterviewFile } from '../../types/DataCollection/shared';
import { toast } from 'react-toastify';

const { ipcRenderer } = window.require('electron');

type Phase = 'none' | 'preparing' | 'prepared' | 'anonymized';

const LoadInterview: FC<{
    processRef: RefObject<{ run: () => Promise<void> } | null>;
}> = ({ processRef }) => {
    const { modeInput, setModeInput, type } = useCollectionContext();
    const { saveWorkspaceData } = useWorkspaceUtils();
    const { uploadFiles, getNamesToAnonymize, submitAnonymizedNames, getInterviewData } =
        useInterviewData();
    const hasSavedRef = useRef(false);

    const [phase, setPhase] = useState<Phase>('none');
    const [localFiles, setLocalFiles] = useState<InterviewFile[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [isPreprocessing, setIsPreprocessing] = useState(false);
    const [namesToAnonymize, setNamesToAnonymize] = useState<string[]>([]);
    const [anonymizedNames, setAnonymizedNames] = useState<Record<string, string>>({});
    const [selectedFilePath, setSelectedFilePath] = useState('');
    const [fileViewModalOpen, setFileViewModalOpen] = useState(false);

    useEffect(() => {
        return () => {
            if (!hasSavedRef.current) {
                saveWorkspaceData();
                hasSavedRef.current = true;
            }
        };
    }, []);

    useEffect(() => {
        if (modeInput?.startsWith('interview|')) {
            const parts = modeInput.split('|');
            const newPhase = parts[1] as Phase;
            setPhase(newPhase);

            try {
                const filesJson = parts.slice(2).join('|');
                const files: InterviewFile[] = JSON.parse(filesJson);
                setLocalFiles(files);
            } catch {
                console.error('Could not parse files from modeInput');
                setLocalFiles([]);
            }
        } else {
            setPhase('none');
            setLocalFiles([]);
        }
    }, [modeInput]);

    useEffect(() => {
        if (phase === 'prepared') {
            setIsPreprocessing(true);
            getInterviewData()
                .then(() => getNamesToAnonymize())
                .then(setNamesToAnonymize)
                .catch(() => toast.error('Failed to load preprocessing data.'))
                .finally(() => setIsPreprocessing(false));
        }
    }, [phase]);

    const handleFileSelect = useCallback(async () => {
        setIsUploading(true);
        try {
            const chosen: InterviewFile[] = await ipcRenderer.invoke('select-files', [
                'docx',
                'txt'
            ]);
            const docxOnly = chosen.filter((f) => f.fileName.endsWith('.docx'));
            if (!docxOnly.length) {
                toast.info('No .docx files selected.');
            } else {
                const merged = [...localFiles, ...docxOnly];
                setLocalFiles(merged);
                setModeInput(`interview|none|${JSON.stringify(merged)}`);
            }
        } catch (err) {
            console.error(err);
            toast.error('Failed to select files.');
        } finally {
            setIsUploading(false);
        }
    }, [localFiles]);

    const handlePreprocess = useCallback(async () => {
        setPhase('preparing');
        setModeInput(`interview|preparing|${JSON.stringify(localFiles)}`);
        setIsPreprocessing(true);
        try {
            await uploadFiles(localFiles.map((f) => f.filePath));
            const names = await getNamesToAnonymize();
            setNamesToAnonymize(names);
            setPhase('prepared');
            setModeInput(`interview|prepared|${JSON.stringify(localFiles)}`);
        } catch {
            toast.error('Preprocessing failed.');
            setPhase('none');
            setModeInput(`interview|none|${JSON.stringify(localFiles)}`);
        } finally {
            setIsPreprocessing(false);
        }
    }, [localFiles]);

    const handleSubmitAnonymizedNames = useCallback(async () => {
        try {
            await submitAnonymizedNames(anonymizedNames);
            toast.success('Names successfully anonymized!');
            setPhase('anonymized');
            setModeInput(`interview|anonymized|${JSON.stringify(localFiles)}`);
        } catch {
            toast.error('Failed to anonymize names.');
        }
    }, [anonymizedNames, localFiles]);

    useImperativeHandle(
        processRef,
        () => ({
            run: async () => {
                if (phase === 'none') {
                    toast.error('No files to process.');
                } else if (phase === 'prepared') {
                    await handleSubmitAnonymizedNames();
                }
            }
        }),
        [phase, anonymizedNames, handleSubmitAnonymizedNames]
    );

    const handleRenderFile = useCallback((filePath: string) => {
        setSelectedFilePath(filePath);
        setFileViewModalOpen(true);
    }, []);

    const handleReset = () => {
        setPhase('none');
        setNamesToAnonymize([]);
        setAnonymizedNames({});
        setModeInput(`interview|none|${JSON.stringify(localFiles)}`);
    };

    if (modeInput && type !== 'interview') {
        return (
            <div className="flex flex-col items-center justify-center h-full p-6">
                <p className="text-red-600 text-lg font-semibold bg-red-100 px-4 py-2 rounded-lg">
                    The loaded data is Reddit data. Please switch to Interview data.
                </p>
            </div>
        );
    }

    return (
        <>
            {(phase === 'none' || phase === 'preparing') && (
                <div className="relative flex flex-col h-full">
                    <UploadInterviewFiles
                        localFiles={localFiles}
                        handleFileSelect={handleFileSelect}
                        handleRemoveFile={(fp) => {
                            const kept = localFiles.filter((f) => f.filePath !== fp);
                            setLocalFiles(kept);
                            setModeInput(`interview|none|${JSON.stringify(kept)}`);
                        }}
                        handleRenderFile={handleRenderFile}
                        handlePreprocess={handlePreprocess}
                        isPreprocessing={false}
                    />

                    {phase === 'preparing' && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white bg-opacity-75 z-10">
                            <p className="text-gray-600">Preprocessing...</p>
                            <div className="w-8 h-8 border-4 border-t-blue-500 border-gray-200 rounded-full animate-spin mt-2" />
                        </div>
                    )}
                </div>
            )}

            {phase === 'prepared' && (
                <div className="flex flex-col h-full w-full">
                    {isPreprocessing ? (
                        <div className="flex flex-col items-center justify-center h-full p-6">
                            <p className="text-gray-600">Loading...</p>
                            <div className="w-8 h-8 border-4 border-t-blue-500 border-gray-200 rounded-full animate-spin mt-2" />
                        </div>
                    ) : (
                        <>
                            <button
                                onClick={handleReset}
                                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
                                Go back
                            </button>
                            <AnonymizeInterviews
                                namesToAnonymize={namesToAnonymize}
                                anonymizedNames={anonymizedNames}
                                handleAnonymizeChange={(orig, anon) =>
                                    setAnonymizedNames((prev) => ({ ...prev, [orig]: anon }))
                                }
                            />
                        </>
                    )}
                </div>
            )}

            {phase === 'anonymized' && (
                <div className="flex flex-col items-center justify-center h-full p-6">
                    <p className="text-green-600 text-lg font-semibold mb-4">
                        Interview data has been prepared.
                    </p>
                    <button
                        onClick={handleReset}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
                        Reset and start over
                    </button>
                </div>
            )}

            {selectedFilePath && (
                <FileViewModal
                    filePath={selectedFilePath}
                    isViewOpen={fileViewModalOpen}
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

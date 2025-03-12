import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AiOutlineLoading3Quarters } from 'react-icons/ai';
import { useWebSocket } from '../../../context/websocket-context';
import { useLogger } from '../../../context/logging-context';
import { useCollectionContext } from '../../../context/collection-context';
import useRedditData from '../../../hooks/DataCollection/use-reddit-data';
import { useApi } from '../../../hooks/Shared/use-api';
import { REMOTE_SERVER_ROUTES, ROUTES as SHARED_ROUTES } from '../../../constants/Shared';
import { ROUTES, LOADER_ROUTES } from '../../../constants/Coding/shared';
import { useWorkspaceContext } from '../../../context/workspace-context';
import { useLoadingContext } from '../../../context/loading-context';
import { useLocation } from 'react-router-dom';
const path = window.require('path');

// Data model for pipeline steps
interface PipelineStep {
    label: string;
    status: 'idle' | 'in-progress' | 'complete' | 'error';
    progress: number; // 0 -> 100
    messages: string[];
}

// Data model for each file
interface FileStatus {
    fileName: string;
    status: 'in-progress' | 'extracting' | 'complete' | 'error' | 'empty';
    progress: number; // 0 -> 100
    completedBytes: number;
    totalBytes: number;
    messages: string[];
}

// Helper function to format bytes into human-readable strings
function formatBytes(bytes: number, decimals = 2): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Helper to parse the mode input string (if needed)
function parseModeInput(modeInput: string) {
    // Expected format: "reddit:torrent:subreddit|start|end|postsOnly"
    const parts = modeInput.split(':');
    if (parts.length !== 3) {
        throw new Error('Invalid mode input format');
    }
    const data = parts[2];
    const [subreddit, start, end, postsOnlyStr] = data.split('|');
    return {
        subreddit,
        start,
        end,
        postsOnly: postsOnlyStr === 'true'
    };
}

// Updated initial steps with a new "Loading dataset" step
const initialSteps: PipelineStep[] = [
    { label: 'Metadata', status: 'idle', progress: 0, messages: [] },
    { label: 'Verification', status: 'idle', progress: 0, messages: [] },
    { label: 'Downloading', status: 'idle', progress: 0, messages: [] },
    { label: 'Symlinks', status: 'idle', progress: 0, messages: [] },
    { label: 'Parsing', status: 'idle', progress: 0, messages: [] },
    { label: 'Loading dataset', status: 'idle', progress: 0, messages: [] }
];

const TorrentLoader: React.FC = () => {
    // New state for torrent metadata
    const [torrentMetadata, setTorrentMetadata] = useState<{
        name: string;
        startDate: string;
        endDate: string;
    }>({
        name: '',
        startDate: '',
        endDate: ''
    });
    const [steps, setSteps] = useState<PipelineStep[]>(initialSteps);
    const [files, setFiles] = useState<Record<string, FileStatus>>({});
    const [messages, setMessages] = useState<string[]>([]);
    const [totalFiles, setTotalFiles] = useState<number>(0);
    // New state for already downloaded files
    const [downloadedFiles, setDownloadedFiles] = useState<string[]>([]);

    const { currentWorkspace } = useWorkspaceContext();
    const { datasetId, modeInput } = useCollectionContext();
    const { fetchData } = useApi();
    const location = useLocation();
    const { abortRequestsByRoute } = useLoadingContext();

    const logBottomRef = useRef<HTMLDivElement>(null);
    const fileBottomRef = useRef<HTMLDivElement>(null);

    // Update total files ref
    const totalFilesRef = useRef(0);
    useEffect(() => {
        totalFilesRef.current = totalFiles;
    }, [totalFiles]);

    const { loadTorrentData } = useRedditData();
    const logger = useLogger();
    const { registerCallback, unregisterCallback } = useWebSocket();

    // Load initial run state including torrent metadata if available
    const loadRunState = async () => {
        const { data, error } = await fetchData(REMOTE_SERVER_ROUTES.GET_TORRENT_STATUS, {
            method: 'POST',
            body: JSON.stringify({ workspace_id: currentWorkspace?.id, dataset_id: datasetId })
        });
        if (error) {
            console.error('Error fetching run state:', error);
            return;
        }
        try {
            if (data.length !== 0 && data[0].run_state) {
                const state = JSON.parse(data[0].run_state);

                // If torrent metadata is provided in state.metadata, use it.
                if (state.overall) {
                    setTorrentMetadata({
                        name: state.overall.subreddit || '',
                        startDate: state.overall.startMonth || '',
                        endDate: state.overall.endMonth || ''
                    });
                } else {
                    // Otherwise, fallback to a placeholder
                    setTorrentMetadata({ name: 'Unknown', startDate: 'N/A', endDate: 'N/A' });
                }

                // Parse steps and files
                const parsedSteps = state.steps.map((step: any) => ({
                    ...step,
                    messages:
                        typeof step.messages === 'string'
                            ? JSON.parse(step.messages)
                            : step.messages
                }));

                const desiredOrder = [
                    'Metadata',
                    'Verification',
                    'Downloading',
                    'Symlinks',
                    'Parsing',
                    'Loading dataset'
                ];
                const sortedSteps = parsedSteps.sort(
                    (a: any, b: any) =>
                        desiredOrder.indexOf(a.label) - desiredOrder.indexOf(b.label)
                );
                setSteps(sortedSteps);

                const parsedFiles: Record<string, FileStatus> = {};
                for (const key in state.files) {
                    const file = state.files[key];
                    const base = path.basename(file.fileName);
                    parsedFiles[base] = {
                        ...file,
                        fileName: base,
                        messages:
                            typeof file.messages === 'string'
                                ? JSON.parse(file.messages)
                                : file.messages
                    };
                }
                setFiles(parsedFiles);

                totalFilesRef.current = Object.keys(state.files).length;
                setTotalFiles(totalFilesRef.current);
            }
        } catch (e) {
            console.error('Error parsing run state:', e);
        }
    };

    useEffect(() => {
        loadRunState();
    }, []);

    useEffect(() => {
        console.log("Registering callback for 'torrent-loader'");
        registerCallback('torrent-loader', handleWebSocketMessage);
        logger.info('Loaded Theme Loader Page');

        return () => {
            unregisterCallback('torrent-loader');
            logger.info('Unloaded Theme Loader Page');
        };
    }, [totalFiles]);

    const completedFiles = Object.values(files).filter((f) => f.status === 'complete').length;
    const overallProgress = totalFiles > 0 ? (completedFiles / totalFiles) * 100 : 0;

    useEffect(() => {
        setSteps((prevSteps) => {
            const updated = [...prevSteps];
            // Update the Downloading step (index 2)
            updated[2] = {
                ...updated[2],
                status: overallProgress === 100 ? 'complete' : 'in-progress',
                progress: overallProgress,
                messages: updated[2].messages
            };
            return updated;
        });
    }, [files, totalFiles, overallProgress]);

    useEffect(() => {
        logBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        fileBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Retry logic
    const handleRetry = async () => {
        setSteps(initialSteps);
        setFiles({});
        setMessages(['Retrying request...']);
        setTotalFiles(0);
        setDownloadedFiles([]);
        logger.info('Retrying request...');
        try {
            abortRequestsByRoute(
                `/${SHARED_ROUTES.CODING}/${ROUTES.LOAD_DATA}/${ROUTES.DATASET_CREATION}`
            );
            abortRequestsByRoute(location.pathname);
            await new Promise((resolve) => setTimeout(resolve, 10000));
            const { subreddit, start, end, postsOnly } = parseModeInput(modeInput);
            await loadTorrentData(true, subreddit, start, end, postsOnly);
        } catch (error) {
            logger.error(`Retry failed: ${error}`);
        }
    };

    // WebSocket message handler – parse incoming messages to update steps, files, and downloaded files
    const handleWebSocketMessage = (message: string) => {
        setMessages((prev) => [...prev, message]);
        parseIncomingMessage(message);
    };

    const parseIncomingMessage = (msg: string) => {
        // 0) Update torrent metadata from different message patterns

        // Pattern 1: "Starting download for subreddit 'uwaterloo' ..."
        const subredditMatch = msg.match(/Starting download for subreddit\s+'([^']+)'/i);
        if (subredditMatch) {
            setTorrentMetadata((prev) => ({
                ...prev,
                name: subredditMatch[1].trim()
            }));
        }

        // Pattern 2: "Fetching torrent data for months 2012-03 through 2012-04..."
        const dateMatch = msg.match(
            /Fetching torrent data for months\s+([\d-]+)\s+through\s+([\d-]+)/i
        );
        if (dateMatch) {
            setTorrentMetadata((prev) => ({
                ...prev,
                startDate: dateMatch[1].trim(),
                endDate: dateMatch[2].trim()
            }));
        }

        // Pattern 3: "Torrent metadata: Name: <name>, Start Date: <date>, End Date: <date>"
        if (msg.includes('Torrent metadata:')) {
            const metaMatch = msg.match(
                /Torrent metadata:\s*Name:\s*(.*?),\s*Start Date:\s*(.*?),\s*End Date:\s*(.*)/i
            );
            if (metaMatch) {
                setTorrentMetadata({
                    name: metaMatch[1].trim(),
                    startDate: metaMatch[2].trim(),
                    endDate: metaMatch[3].trim()
                });
            }
        }

        // 1) If "Files to process:" => set totalFiles
        if (msg.includes('Files to process:')) {
            const match = msg.match(/Files to process:\s*(\d+)/);
            if (match) {
                setTotalFiles(parseInt(match[1], 10));
            }
        }
        // 2) Capture already downloaded files
        if (msg.includes('Files already downloaded:')) {
            const match = msg.match(/Files already downloaded:\s*(.*)/);
            if (match) {
                const filesList = match[1].split(',').map((f) => f.trim());
                setDownloadedFiles(filesList);
            }
        }
        // 3) Update pipeline steps
        setSteps((prevSteps) => {
            const updated = [...prevSteps];
            // METADATA
            if (msg.includes('Metadata progress:')) {
                const match = msg.match(/Metadata progress:\s+([\d.]+)/);
                const percent = match ? parseFloat(match[1]) : 0;
                updated[0] = {
                    ...updated[0],
                    status: 'in-progress',
                    progress: Math.max(updated[0].progress, percent),
                    messages: [...updated[0].messages, msg]
                };
            }
            if (msg.includes('Metadata download complete')) {
                updated[0] = {
                    ...updated[0],
                    status: 'complete',
                    progress: 100,
                    messages: [...updated[0].messages, msg]
                };
            }
            // VERIFICATION
            if (msg.includes('Verification in progress:')) {
                updated[1] = {
                    ...updated[1],
                    status: 'in-progress',
                    progress: 50,
                    messages: [...updated[1].messages, msg]
                };
            }
            if (msg.includes('Torrent verified')) {
                updated[1] = {
                    ...updated[1],
                    status: 'complete',
                    progress: 100,
                    messages: [...updated[1].messages, msg]
                };
            }
            // DOWNLOADING
            if (
                msg.includes('Finished downloading') ||
                msg.includes('All wanted files have been processed')
            ) {
                updated[2] = {
                    ...updated[2],
                    status: 'complete',
                    progress: 100,
                    messages: [...updated[2].messages, msg]
                };
            } else if (
                msg.toLowerCase().includes('downloading file') ||
                msg.toLowerCase().includes('file has been fully downloaded')
            ) {
                if (updated[2].status !== 'complete') {
                    updated[2] = {
                        ...updated[2],
                        status: 'in-progress',
                        progress: Math.max(updated[2].progress, 50),
                        messages: [...updated[2].messages, msg]
                    };
                }
            }
            // SYMLINKS
            // if (msg.includes('Symlink created:')) {
            //     if (updated[3].status === 'idle') {
            //         updated[3] = {
            //             ...updated[3],
            //             status: 'in-progress',
            //             progress: 50,
            //             messages: [...updated[3].messages, msg]
            //         };
            //     }
            // }
            // if (msg.includes('Parsing files into dataset')) {
            //     updated[3] = {
            //         ...updated[3],
            //         status: 'complete',
            //         progress: 100,
            //         messages: [...updated[3].messages, msg]
            //     };
            // }
            // PARSING
            if (msg.includes('Parsing files into dataset')) {
                updated[4] = {
                    ...updated[4],
                    status: 'in-progress',
                    progress: 30,
                    messages: [...updated[4].messages, msg]
                };
            }
            if (msg.includes('Parsing complete') || msg.includes('All steps finished')) {
                updated[4] = {
                    ...updated[4],
                    status: 'complete',
                    progress: 100,
                    messages: [...updated[4].messages, msg]
                };
            }
            // LOADING DATASET (new step)
            if (msg.includes('Loading dataset, this may take a few moments')) {
                updated[5] = {
                    ...updated[5],
                    status: 'in-progress',
                    progress: 50,
                    messages: [...updated[5].messages, msg]
                };
            }
            if (msg.includes('Dataset loaded')) {
                updated[5] = {
                    ...updated[5],
                    status: 'complete',
                    progress: 100,
                    messages: [...updated[5].messages, msg]
                };
            }
            // ERRORS
            if (msg.toLowerCase().includes('error')) {
                const errIndex = updated.findIndex(
                    (s) => s.status === 'in-progress' || s.status === 'idle'
                );
                if (errIndex !== -1) {
                    updated[errIndex] = {
                        ...updated[errIndex],
                        status: 'error',
                        messages: [...updated[errIndex].messages, msg]
                    };
                }
            }
            return updated;
        });

        // 4) Update file-specific info (unchanged)
        setFiles((prevFiles) => {
            const updated = { ...prevFiles };
            if (
                msg.toLowerCase().includes('processing file:') ||
                msg.toLowerCase().includes('processed file:')
            ) {
                const match = msg.match(/(Processing|Processed)\s+file:\s+(.*?)(\s|\(|\.\.\.|$)/i);
                if (match) {
                    const fullPath = match[2].trim();
                    const base = path.basename(fullPath);
                    if (!updated[base]) {
                        updated[base] = {
                            fileName: base,
                            status: 'in-progress',
                            progress: 0,
                            completedBytes: 0,
                            totalBytes: 0,
                            messages: [msg]
                        };
                    } else {
                        updated[base].messages.push(msg);
                    }
                }
            }
            if (msg.toLowerCase().includes('downloading') && msg.includes('%')) {
                const match = msg.match(
                    /Downloading\s+(.*?):\s+([\d.]+)%\s+\(([\d]+)\/([\d]+)\s+bytes\)/i
                );
                if (match) {
                    const fullPath = match[1].trim();
                    const base = path.basename(fullPath);
                    const percent = parseFloat(match[2]);
                    const completed = parseInt(match[3], 10);
                    const total = parseInt(match[4], 10);
                    if (!updated[base]) {
                        updated[base] = {
                            fileName: base,
                            status: 'in-progress',
                            progress: percent,
                            completedBytes: completed,
                            totalBytes: total,
                            messages: [msg]
                        };
                    } else {
                        updated[base] = {
                            ...updated[base],
                            status: 'in-progress',
                            progress: percent,
                            completedBytes: completed,
                            totalBytes: total,
                            messages: [...updated[base].messages, msg]
                        };
                    }
                }
            }
            if (msg.toLowerCase().includes('fully downloaded')) {
                const match = msg.match(
                    /File\s+(.*)\s+fully downloaded.*\(([\d]+)\/([\d]+)\s+bytes\)/i
                );
                if (match) {
                    const fullPath = match[1].trim();
                    const base = path.basename(fullPath);
                    const completed = parseInt(match[2], 10);
                    const total = parseInt(match[3], 10);
                    if (!updated[base]) {
                        updated[base] = {
                            fileName: base,
                            status: 'complete',
                            progress: 100,
                            completedBytes: completed,
                            totalBytes: total,
                            messages: [msg]
                        };
                    } else {
                        updated[base] = {
                            ...updated[base],
                            status: 'complete',
                            progress: 100,
                            completedBytes: completed,
                            totalBytes: total,
                            messages: [...updated[base].messages, msg]
                        };
                    }
                }
            }
            if (msg.includes('Extracting')) {
                const match = msg.match(/Extracting.*from\s+(.*?\.zst)(\.\.\.)?/i);
                if (match) {
                    const fullPath = match[1].trim();
                    const base = path.basename(fullPath);
                    if (updated[base]) {
                        updated[base].status = 'extracting';
                        updated[base].messages.push(msg);
                    }
                }
            }
            if (msg.includes('JSON extracted:')) {
                const match = msg.match(/JSON extracted:\s+(.*)\/(R[S|C]_[\d-]+)\.json/i);
                if (match) {
                    const base = match[2] + '.zst';
                    if (updated[base]) {
                        updated[base].status = 'complete';
                        updated[base].progress = 100;
                        updated[base].messages.push(msg);
                    }
                }
            }
            if (msg.toLowerCase().includes('error downloading')) {
                const match = msg.match(/ERROR downloading\s+(.*?):/i);
                if (match) {
                    const fullPath = match[1].trim();
                    const base = path.basename(fullPath);
                    if (!updated[base]) {
                        updated[base] = {
                            fileName: base,
                            status: 'error',
                            progress: 0,
                            completedBytes: 0,
                            totalBytes: 0,
                            messages: [msg]
                        };
                    } else {
                        updated[base] = {
                            ...updated[base],
                            status: 'error',
                            messages: [...updated[base].messages, msg]
                        };
                    }
                }
            }
            return updated;
        });
    };
    // Create an array of file objects
    const fileList = Object.values(files);

    return (
        <div className="h-page w-full flex flex-col lg:flex-row gap-6 max-w-6xl bg-white rounded-lg shadow-lg overflow-hidden">
            {/* Left Panel: Steps + File List */}
            <div className="w-full lg:w-2/3 p-6 flex flex-col h-full">
                {/* Torrent Pipeline Heading + Metadata */}
                <div className="mb-4">
                    <h2 className="text-xl font-bold">Torrent Pipeline</h2>
                    <div className="flex justify-evenly w-full overflow-wrap text-sm text-gray-600 mt-1">
                        <p>
                            <strong>Name:</strong> {torrentMetadata.name || 'N/A'}
                        </p>
                        <p>
                            <strong>Start Date:</strong> {torrentMetadata.startDate || 'N/A'}
                        </p>
                        <p>
                            <strong>End Date:</strong> {torrentMetadata.endDate || 'N/A'}
                        </p>
                    </div>
                </div>
                {/* Pipeline Steps */}
                <div className="flex flex-col h-max gap-4">
                    {/* <div className="flex flex-col"> */}
                    {steps.map((step, index) => {
                        if (index === 3) return <></>;

                        const isInProgress = step.status === 'in-progress';
                        const isComplete = step.status === 'complete';
                        const isError = step.status === 'error';

                        let barColor = 'bg-gray-300';
                        if (isInProgress) barColor = 'bg-blue-400';
                        if (isComplete) barColor = 'bg-green-500';
                        if (isError) barColor = 'bg-red-500';

                        return (
                            <motion.div
                                key={step.label}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3, delay: index * 0.1 }}
                                className="flex flex-col">
                                <div className="flex justify-between text-sm font-semibold">
                                    <span>{step.label}</span>
                                    {step.progress > 0 && <span>{Math.round(step.progress)}%</span>}
                                </div>
                                <div className="w-full h-2 bg-gray-200 rounded mt-1 overflow-hidden">
                                    <motion.div
                                        className={`${barColor} h-2`}
                                        initial={{ width: 0 }}
                                        animate={{ width: `${step.progress}%` }}
                                        transition={{ duration: 0.4 }}
                                    />
                                </div>
                                {isError && (
                                    <div className="text-xs text-red-600 mt-1">
                                        An error occurred. Check the log.
                                    </div>
                                )}
                            </motion.div>
                        );
                    })}
                    {/* </div> */}
                </div>

                {/* File Downloads Heading + Already Downloaded Files */}
                {/* <div className="mt-8 flex flex-col h-full"> */}
                <h2 className="text-xl font-bold mb-2 mt-8">File Downloads</h2>
                {!!downloadedFiles.length && (
                    <div className="text-sm text-gray-600 mb-4">
                        <strong>Already downloaded files:</strong> {downloadedFiles.join(', ')}
                    </div>
                )}
                <p className="text-sm mb-4">
                    RC (Reddit Comments) and RS (Reddit Submissions/Posts) are downloaded separately
                    and combined at the end
                </p>
                <div className="space-y-2 flex-1 overflow-y-auto min-h-0">
                    {fileList.length === 0 ? (
                        <div className="text-sm text-gray-500">No files processed yet...</div>
                    ) : (
                        fileList.map((f, idx) => {
                            const isComplete = f.status === 'complete';
                            const isEmpty = f.status === 'empty';
                            const isError = f.status === 'error';
                            const isExtracting = f.status === 'extracting';

                            let barColor = 'bg-blue-400';
                            if (isComplete) barColor = 'bg-green-500';
                            if (isError) barColor = 'bg-red-500';

                            return (
                                <motion.div
                                    key={f.fileName}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.3, delay: idx * 0.1 }}
                                    className="p-3 bg-gray-50 rounded shadow-sm">
                                    <div className="flex justify-between text-sm font-medium mb-1">
                                        <span>{f.fileName}</span>
                                        {f.totalBytes > 0 && (
                                            <span>
                                                {formatBytes(f.completedBytes)}/
                                                {formatBytes(f.totalBytes)}
                                            </span>
                                        )}
                                    </div>
                                    {isExtracting && (
                                        <div className="flex items-center text-xs text-gray-600 mb-1">
                                            <AiOutlineLoading3Quarters className="animate-spin mr-1" />
                                            <span>Extracting data for subreddit requested...</span>
                                        </div>
                                    )}
                                    <div className="w-full h-2 bg-gray-200 rounded mt-1 overflow-hidden">
                                        <motion.div
                                            className={`${barColor} h-2`}
                                            initial={{ width: 0 }}
                                            animate={{ width: `${f.progress}%` }}
                                            transition={{ duration: 0.4 }}
                                        />
                                    </div>
                                    {isError && (
                                        <div className="text-xs text-red-600 mt-1">
                                            Error in this file. Check the log.
                                        </div>
                                    )}
                                    {isComplete && (
                                        <div className="text-xs text-green-600 mt-1">
                                            File process complete!
                                        </div>
                                    )}
                                    {isEmpty && (
                                        <div className="text-xs text-gray-600 mt-1">
                                            No data found for this subreddit in this file.
                                        </div>
                                    )}
                                </motion.div>
                            );
                        })
                    )}
                    <div ref={fileBottomRef} />
                </div>
            </div>
            {/* </div> */}

            {/* Right Panel: Detailed Log + Retry */}
            <div className="w-full lg:w-1/3 bg-gray-50 p-4 border-l border-gray-200 h-full flex flex-col min-h-0">
                <h3 className="font-bold mb-2">Detailed Log</h3>
                <div className="flex-1 overflow-y-auto text-xs leading-5 overflow-wrap">
                    <AnimatePresence>
                        {messages.map((msg, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -5 }}
                                transition={{ duration: 0.2 }}
                                className="mb-1">
                                {msg}
                            </motion.div>
                        ))}
                    </AnimatePresence>
                    <div ref={logBottomRef} />
                </div>
                <div className="mt-4">
                    <button
                        onClick={handleRetry}
                        className="w-full py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none">
                        Retry Request
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TorrentLoader;

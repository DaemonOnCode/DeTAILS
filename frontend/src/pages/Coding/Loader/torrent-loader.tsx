import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AiOutlineLoading3Quarters,
    AiOutlineCheckCircle,
    AiOutlineCloseCircle
} from 'react-icons/ai';
import { useWebSocket } from '../../../context/websocket-context';
import { useLogger } from '../../../context/logging-context';

/**
 * Data model for the "high-level" pipeline steps
 */
interface PipelineStep {
    label: string;
    status: 'idle' | 'in-progress' | 'complete' | 'error';
    progress: number; // 0 -> 100
    messages: string[];
}

/**
 * Data model for each file being downloaded/processed
 */
interface FileStatus {
    fileName: string;
    status: 'in-progress' | 'complete' | 'error';
    progress: number; // 0 -> 100
    completedBytes: number; // how many bytes downloaded
    totalBytes: number; // total bytes
    messages: string[]; // any logs specific to this file
}

/**
 * The main loader component
 */
const TorrentLoader: React.FC = () => {
    /**
     * We keep:
     * 1. A list of pipeline steps (metadata, verification, downloading, symlinks, parsing).
     * 2. A map of fileName -> FileStatus for per-file tracking.
     * 3. A log of all raw messages from the server.
     */
    const [steps, setSteps] = useState<PipelineStep[]>([
        { label: 'Metadata', status: 'idle', progress: 0, messages: [] },
        { label: 'Verification', status: 'idle', progress: 0, messages: [] },
        { label: 'Downloading', status: 'idle', progress: 0, messages: [] },
        { label: 'Symlinks', status: 'idle', progress: 0, messages: [] },
        { label: 'Parsing', status: 'idle', progress: 0, messages: [] }
    ]);

    const [files, setFiles] = useState<Record<string, FileStatus>>({});
    const [messages, setMessages] = useState<string[]>([]);

    const handleWebSocketMessage = (message: string) => {
        setMessages((prev) => [...prev, message]);
        parseIncomingMessage(message);
    };

    const logger = useLogger();
    const { registerCallback, unregisterCallback } = useWebSocket();

    /**
     * Open WebSocket connection on mount
     */
    useEffect(() => {
        registerCallback('theme-loader', handleWebSocketMessage);
        logger.info('Loaded Theme Loader Page');

        return () => {
            unregisterCallback('theme-loader');
            logger.info('Unloaded Theme Loader Page');
        };
    }, []);

    /**
     * Interpret server messages and update steps/files accordingly
     */
    const parseIncomingMessage = (msg: string) => {
        // 1) Update pipeline steps if relevant
        setSteps((prev) => {
            // We'll copy the steps array so we can mutate safely
            const updated = [...prev];

            // --- METADATA STEP ---
            if (msg.includes('Metadata progress:')) {
                const match = msg.match(/Metadata progress:\s+([\d.]+)/);
                const percent = match ? parseFloat(match[1]) : 0;
                // Mark as in-progress
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

            // --- VERIFICATION STEP ---
            if (msg.includes('Verification in progress:')) {
                // We'll just set an arbitrary 50% if you want
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

            // --- DOWNLOADING STEP ---
            // We'll treat "Finished downloading X files" as step complete
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
                // If we see anything about downloading files, let's set the step in progress
                if (updated[2].status !== 'complete') {
                    updated[2] = {
                        ...updated[2],
                        status: 'in-progress',
                        // We'll keep the step's progress at 50 or so
                        progress: Math.max(updated[2].progress, 50),
                        messages: [...updated[2].messages, msg]
                    };
                }
            }

            // --- SYMLINKS STEP ---
            // We'll interpret "Symlink created" as progress
            if (msg.includes('Symlink created:')) {
                // If not already in progress or complete, set in progress
                if (updated[3].status === 'idle') {
                    updated[3] = {
                        ...updated[3],
                        status: 'in-progress',
                        progress: 50,
                        messages: [...updated[3].messages, msg]
                    };
                }
            }
            // Once we see "Parsing files into dataset" we can assume symlinks are done
            if (msg.includes('Parsing files into dataset')) {
                updated[3] = {
                    ...updated[3],
                    status: 'complete',
                    progress: 100,
                    messages: [...updated[3].messages, msg]
                };
            }

            // --- PARSING STEP ---
            if (msg.includes('Parsing files into dataset')) {
                // Indicate parsing started
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

            // --- ERRORS ---
            // If we see the word "ERROR" or "error" we mark the current step as error
            if (msg.toLowerCase().includes('error')) {
                // Find the first step that's in-progress or idle
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

        // 2) Update per-file info (if present)
        setFiles((prev) => {
            const updated = { ...prev };

            // We’ll look for patterns:
            //   "Processing file: foo.zst (ID: 123)"
            //   "Downloading foo.zst: 40.00% (400 / 1000 bytes)"
            //   "File foo.zst fully downloaded"
            //   "ERROR downloading foo.zst: something"

            // 2a) "Processing file: X"
            if (msg.toLowerCase().includes('processing file:')) {
                // Extract file name
                // e.g. "Processing file: data_2020_01.zst"
                const match = msg.match(/Processing file:\s+(.*?)(\s|\(|$)/i);
                if (match) {
                    const fileName = match[1].trim();
                    if (!updated[fileName]) {
                        updated[fileName] = {
                            fileName,
                            status: 'in-progress',
                            progress: 0,
                            completedBytes: 0,
                            totalBytes: 0,
                            messages: [msg]
                        };
                    }
                }
            }

            // 2b) "Downloading X: 12.34% (123456 / 1000000 bytes)"
            if (msg.toLowerCase().includes('downloading') && msg.includes('%')) {
                // Attempt to parse file name, percent, completed, total
                // Example: "Downloading data_2020_01.zst: 12.34% (123456/1000000 bytes)"
                const match = msg.match(
                    /Downloading\s+(.*?):\s+([\d.]+)%\s+\(([\d]+)\/([\d]+)\s+bytes\)/i
                );
                if (match) {
                    const fileName = match[1].trim();
                    const percent = parseFloat(match[2]);
                    const completed = parseInt(match[3], 10);
                    const total = parseInt(match[4], 10);

                    if (!updated[fileName]) {
                        updated[fileName] = {
                            fileName,
                            status: 'in-progress',
                            progress: percent,
                            completedBytes: completed,
                            totalBytes: total,
                            messages: [msg]
                        };
                    } else {
                        updated[fileName] = {
                            ...updated[fileName],
                            status: 'in-progress',
                            progress: percent,
                            completedBytes: completed,
                            totalBytes: total,
                            messages: [...updated[fileName].messages, msg]
                        };
                    }
                }
            }

            // 2c) "File X fully downloaded (Y / Z bytes)."
            if (msg.toLowerCase().includes('fully downloaded')) {
                const match = msg.match(
                    /File\s+(.*)\s+fully downloaded.*\(([\d]+)\/([\d]+)\s+bytes\)/i
                );
                if (match) {
                    const fileName = match[1].trim();
                    const completed = parseInt(match[2], 10);
                    const total = parseInt(match[3], 10);

                    if (!updated[fileName]) {
                        updated[fileName] = {
                            fileName,
                            status: 'complete',
                            progress: 100,
                            completedBytes: completed,
                            totalBytes: total,
                            messages: [msg]
                        };
                    } else {
                        updated[fileName] = {
                            ...updated[fileName],
                            status: 'complete',
                            progress: 100,
                            completedBytes: completed,
                            totalBytes: total,
                            messages: [...updated[fileName].messages, msg]
                        };
                    }
                }
            }

            // 2d) "ERROR downloading X:"
            if (msg.toLowerCase().includes('error downloading')) {
                const match = msg.match(/ERROR downloading\s+(.*?):/i);
                if (match) {
                    const fileName = match[1].trim();
                    if (!updated[fileName]) {
                        updated[fileName] = {
                            fileName,
                            status: 'error',
                            progress: 0,
                            completedBytes: 0,
                            totalBytes: 0,
                            messages: [msg]
                        };
                    } else {
                        updated[fileName] = {
                            ...updated[fileName],
                            status: 'error',
                            messages: [...updated[fileName].messages, msg]
                        };
                    }
                }
            }

            return updated;
        });
    };

    /**
     * RENDER
     */
    // Convert the file map to an array so we can render easily
    const fileList = Object.values(files);

    return (
        <div className="h-page w-full flex items-center justify-center bg-gray-100 p-4">
            <div className="flex flex-col lg:flex-row gap-6 w-full max-w-6xl bg-white rounded-lg shadow-lg overflow-hidden">
                {/** Left Panel: Step Timeline + File Table */}
                <div className="w-full lg:w-2/3 p-6 flex flex-col gap-8">
                    {/* Pipeline Steps */}
                    <div>
                        <h2 className="text-xl font-bold mb-4">Overall Pipeline</h2>
                        <div className="flex flex-col gap-4">
                            {steps.map((step, index) => {
                                const isInProgress = step.status === 'in-progress';
                                const isComplete = step.status === 'complete';
                                const isError = step.status === 'error';

                                // Choose a color
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
                                            {step.progress > 0 && (
                                                <span>{Math.round(step.progress)}%</span>
                                            )}
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
                                                An error occurred in this step. Check the log.
                                            </div>
                                        )}
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>

                    {/* File-by-file Table */}
                    <div>
                        <h2 className="text-xl font-bold mb-4">File Downloads</h2>
                        <div className="space-y-2">
                            {fileList.length === 0 ? (
                                <div className="text-sm text-gray-500">
                                    No files processed yet...
                                </div>
                            ) : (
                                fileList.map((f, idx) => {
                                    const isComplete = f.status === 'complete';
                                    const isError = f.status === 'error';
                                    const isInProgress = f.status === 'in-progress';

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
                                                        {f.completedBytes}/{f.totalBytes} bytes
                                                    </span>
                                                )}
                                            </div>
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
                                                    Download complete!
                                                </div>
                                            )}
                                        </motion.div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>

                {/** Right Panel: Detailed Log */}
                <div className="w-full lg:w-1/3 bg-gray-50 p-4 border-l border-gray-200 overflow-auto">
                    <h3 className="font-bold mb-2">Detailed Log</h3>
                    <div className="h-full max-h-[70vh] overflow-y-auto text-xs leading-5">
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
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TorrentLoader;

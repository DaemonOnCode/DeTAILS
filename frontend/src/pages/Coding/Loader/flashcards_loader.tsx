import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FaLaptop, FaToolbox, FaFileAlt, FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';
import { useCollectionContext } from '../../../context/collection_context';

const { ipcRenderer } = window.require('electron');

const FlashcardsLoaderPage = () => {
    const { datasetId } = useCollectionContext();

    const [stage, setStage] = useState('Starting...');
    const [flashcards, setFlashcards] = useState<number[]>([]);

    useEffect(() => {
        ipcRenderer.on('ws-message', (e: any, data: string) => {
            const message = data.toString();

            if (message.includes(`Dataset ${datasetId}:`)) {
                if (message.includes('Uploading files')) {
                    setStage('Uploading Files...');
                } else if (message.includes('Files uploaded successfully')) {
                    setStage('Files Uploaded');
                } else if (message.includes('Creating retriever')) {
                    setStage('Creating Retriever...');
                } else if (message.includes('Generating flashcards')) {
                    setStage('Generating Flashcards...');
                    const interval = setInterval(() => {
                        setFlashcards((prev) =>
                            prev.length < 12 ? [...prev, prev.length + 1] : []
                        );
                    }, 1000);
                    return () => clearInterval(interval);
                } else if (message.includes('Parsing generated flashcards')) {
                    setStage('Parsing Flashcards...');
                } else if (message.includes('Processing complete')) {
                    setStage('Processing Complete');
                } else if (message.includes('Error encountered')) {
                    setStage('Error: Check Server Logs');
                }
            }
        });

        return () => {
            ipcRenderer.removeAllListeners('ws-message');
        };
    }, [datasetId, flashcards]);

    const fileVariants = {
        initial: { x: 0, opacity: 1 },
        animate: {
            x: [0, 550], // Compact animation distance
            opacity: [1, 0], // Fade out near the end
            transition: {
                duration: 4, // Smooth and consistent animation duration
                ease: 'easeInOut',
                repeat: Infinity // Infinite animation
            }
        }
    };

    const staggeredFiles = {
        animate: {
            transition: {
                staggerChildren: 0.5 // Delay between each document animation
            }
        }
    };

    const cardColors = ['bg-blue-700', 'bg-blue-800', 'bg-blue-900', 'bg-blue-950'];

    return (
        <div className="min-h-panel w-full flex flex-col gap-6 items-center justify-center bg-gray-100">
            <h1 className="text-2xl font-bold text-center mb-6">{stage}</h1>

            {/* Stage 1: Uploading Files */}
            {stage.includes('Uploading Files') && (
                <div className="relative flex items-center justify-between w-2/3 h-32">
                    {/* Left: Laptop Icon */}
                    <div className="flex items-center justify-center w-20 h-20 text-blue-600">
                        <FaLaptop size={40} />
                    </div>

                    {/* Center: Moving Files */}
                    <motion.div
                        className="relative flex gap-4 items-center w-full"
                        variants={staggeredFiles}
                        initial="initial"
                        animate="animate">
                        {[1, 2, 3].map((_, index) => (
                            <motion.div
                                key={index}
                                className="absolute text-blue-500 text-3xl"
                                variants={fileVariants}>
                                <FaFileAlt />
                            </motion.div>
                        ))}
                    </motion.div>

                    {/* Right: Toolkit Box */}
                    <div className="flex flex-col items-center justify-center w-24 h-24 bg-gray-300 rounded-md shadow-md text-gray-800">
                        <FaToolbox size={30} className="mb-2" />
                        <span className="text-sm font-bold">Toolkit</span>
                    </div>
                </div>
            )}

            {/* Stage 2: Generating Flashcards */}
            {stage.includes('Generating Flashcards') && (
                <div className="relative w-full flex flex-col items-center">
                    <div className="relative w-full max-w-3xl h-[500px] bg-gray-200 rounded-lg shadow-md p-8 flex items-center justify-center">
                        <div className="grid grid-cols-4 gap-6">
                            {flashcards.map((card, index) => (
                                <motion.div
                                    key={index}
                                    className={`w-24 h-32 ${cardColors[index % cardColors.length]} text-white rounded-lg shadow-lg flex items-center justify-center`}
                                    initial={{ scale: 0, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ duration: 1.2 }}>
                                    {card}
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Completion State */}
            {stage === 'Processing Complete' && (
                <motion.div
                    className="text-green-600 text-6xl flex flex-col items-center"
                    initial="initial"
                    animate={{
                        scale: [1, 1.2, 1],
                        opacity: [1, 0.8, 1],
                        transition: { duration: 1, repeat: Infinity }
                    }}>
                    <FaCheckCircle />
                    <span className="text-lg font-bold mt-2">Flashcards Generated!</span>
                </motion.div>
            )}

            {/* Error State */}
            {stage.includes('Error') && (
                <motion.div
                    className="text-red-600 text-6xl flex flex-col items-center"
                    initial="initial"
                    animate={{
                        scale: [1, 1.2, 1],
                        opacity: [1, 0.8, 1],
                        transition: { duration: 1, repeat: Infinity }
                    }}>
                    <FaExclamationCircle />
                    <span className="text-lg font-bold mt-2">An error occurred</span>
                </motion.div>
            )}
        </div>
    );
};

export default FlashcardsLoaderPage;

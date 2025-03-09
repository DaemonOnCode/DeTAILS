import React, { useEffect, useState } from 'react';
import { Variants, motion, useAnimation } from 'framer-motion';
import { FaLaptop, FaToolbox, FaFileAlt } from 'react-icons/fa';
import { useLogger } from '../../../context/logging-context';
import { useWebSocket } from '../../../context/websocket-context';
import { DetailsIcon } from '../../../components/Shared/Icons';

const generateRectangles = () => {
    return Array.from({ length: 30 }, (_, index) => ({
        id: `rectangle-${index}`,
        size: Math.random() * 50 + 20,
        x: Math.random() * 1200 - 600,
        y: Math.random() * 800 - 400,
        delay: Math.random() * 2
    }));
};

const rectangles = generateRectangles();

const ThemeLoaderPage = () => {
    const logger = useLogger();
    const [stage, setStage] = useState('Starting');
    const controls = useAnimation();

    const { registerCallback, unregisterCallback } = useWebSocket();

    const handleWebSocketMessage = (message: string) => {
        if (message.includes('Uploading files')) {
            setStage('Uploading files');
        } else if (message.includes('Files uploaded successfully')) {
            setStage('Files Uploaded');
        } else if (message.includes('Using Retrieval-Augmented Generation (RAG)')) {
            setStage('Generating Keywords');
        } else if (message.includes('LLM process completed successfully')) {
            setStage('Processing Complete');
        } else if (message.includes('Error encountered')) {
            setStage('Error: Check Server Logs');
        }
    };

    useEffect(() => {
        registerCallback('theme-loader', handleWebSocketMessage);
        logger.info('Loaded Theme Loader Page');

        return () => {
            unregisterCallback('theme-loader');
            logger.info('Unloaded Theme Loader Page');
        };
    }, []);

    useEffect(() => {
        if (stage === 'Uploading files') {
            let isMounted = true;

            const startAnimationLoop = async () => {
                while (isMounted) {
                    await controls.start('animate');
                    await new Promise((resolve) => setTimeout(resolve, 500));
                }
            };

            startAnimationLoop();

            return () => {
                isMounted = false;
            };
        }
    }, [stage, controls]);

    const staggeredFiles: Variants = {
        initial: { opacity: 0, x: 0 },
        animate: {
            opacity: 1,
            transition: {
                staggerChildren: 0.3
            }
        }
    };

    const fileVariants: Variants = {
        initial: { x: 0, opacity: 1 },
        animate: {
            x: [0, 550],
            opacity: [1, 0],
            transition: {
                duration: 4,
                ease: 'easeInOut'
            }
        }
    };

    return (
        <div className="min-h-page w-full flex flex-col gap-6 items-center justify-center">
            {stage !== 'Generating Keywords' && (
                <h1 className="text-2xl font-bold text-center mb-6">{stage}</h1>
            )}

            {stage === 'Uploading files' && (
                <div className="relative flex items-center justify-between w-2/3 h-32">
                    <div className="flex items-center justify-center w-20 h-20 text-blue-600">
                        <FaLaptop size={50} />
                    </div>

                    {/* Center: Staggered Moving Files */}
                    <motion.div
                        className="relative flex gap-4 items-center w-full"
                        variants={staggeredFiles}
                        initial="initial"
                        animate={controls}>
                        {[1, 2, 3].map((_, index) => (
                            <motion.div
                                key={index}
                                className="absolute text-blue-500 text-3xl"
                                variants={fileVariants}>
                                <FaFileAlt />
                            </motion.div>
                        ))}
                    </motion.div>

                    <div className="flex flex-col items-center justify-center w-24 h-24 bg-gray-300 rounded-md shadow-md text-gray-800 p-2">
                        <DetailsIcon className="h-20 w-20" />
                        {/* <span className="text-sm font-bold">Toolkit</span> */}
                    </div>
                </div>
            )}

            {stage === 'Generating Keywords' && (
                <div className="relative w-full min-h-page flex items-center justify-center overflow-hidden">
                    <motion.h1
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 1.5 }}
                        className="text-gray-800 text-4xl font-bold tracking-wide z-10">
                        Generating Keywords
                    </motion.h1>

                    {/* Dynamic Rectangles */}
                    <div className="absolute">
                        {rectangles.map((rect) => (
                            <motion.div
                                key={rect.id}
                                className="absolute rounded-md"
                                style={{
                                    width: `${rect.size}px`,
                                    height: `${rect.size}px`,
                                    backgroundColor: `rgba(${Math.floor(Math.random() * 150 + 100)}, ${Math.floor(
                                        Math.random() * 150 + 100
                                    )}, ${Math.floor(Math.random() * 150 + 100)}, 1)`
                                }}
                                initial={{
                                    opacity: 0,
                                    scale: 0.8,
                                    x: 0,
                                    y: 0
                                }}
                                animate={{
                                    opacity: [0, 0.8, 0],
                                    scale: [0.8, 1.2, 0.8],
                                    x: rect.x,
                                    y: rect.y
                                }}
                                transition={{
                                    delay: rect.delay,
                                    duration: 5,
                                    repeat: Infinity,
                                    repeatType: 'loop',
                                    ease: 'easeInOut'
                                }}
                            />
                        ))}
                    </div>
                </div>
            )}

            {stage === 'Processing Complete' && (
                <motion.div
                    className="text-green-600 text-6xl flex flex-col items-center"
                    initial="initial"
                    animate={{
                        scale: [1, 1.2, 1],
                        opacity: [1, 0.8, 1],
                        transition: { duration: 1, repeat: Infinity }
                    }}>
                    <span className="text-lg font-bold mt-2">Keywords Generated!</span>
                </motion.div>
            )}

            {stage.includes('Error') && (
                <motion.div
                    className="text-red-600 text-6xl flex flex-col items-center"
                    initial="initial"
                    animate={{
                        scale: [1, 1.2, 1],
                        opacity: [1, 0.8, 1],
                        transition: { duration: 1, repeat: Infinity }
                    }}>
                    <span className="text-lg font-bold mt-2">An error occurred</span>
                </motion.div>
            )}
        </div>
    );
};

export default ThemeLoaderPage;

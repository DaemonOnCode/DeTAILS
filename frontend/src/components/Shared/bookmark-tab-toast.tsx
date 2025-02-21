import React, { useEffect, useState, useRef } from 'react';
import {
    IoMdNotifications,
    IoMdCheckmark,
    IoMdClose,
    IoMdInformationCircle,
    IoMdAlert
} from 'react-icons/io';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast, Toast } from '../../context/toast-context';

const overlayVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 }
};

const BookmarkOverlay: React.FC = () => {
    const { toasts, removeToast } = useToast();
    const currentToast: Toast | undefined = toasts[0];
    const duration = currentToast?.duration ?? 5000;

    const [progress, setProgress] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [accumulatedElapsed, setAccumulatedElapsed] = useState(0);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const lastStartRef = useRef<number>(0);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (currentToast && currentToast.startTime) {
            const initialElapsed = Date.now() - currentToast.startTime;
            setAccumulatedElapsed(initialElapsed);
            setProgress(Math.min((initialElapsed / duration) * 100, 100));
            lastStartRef.current = Date.now();
        } else {
            setAccumulatedElapsed(0);
            lastStartRef.current = 0;
            setProgress(0);
        }
    }, [currentToast, duration]);

    useEffect(() => {
        if (!isOpen && currentToast) {
            if (!lastStartRef.current) {
                lastStartRef.current = Date.now();
            }
            intervalRef.current = setInterval(() => {
                const elapsedSinceStart = Date.now() - lastStartRef.current;
                const totalElapsed = accumulatedElapsed + elapsedSinceStart;
                const newProgress = Math.min((totalElapsed / duration) * 100, 100);
                setProgress(newProgress);
                if (newProgress >= 100) {
                    clearInterval(intervalRef.current!);
                    removeToast(currentToast.id);
                    setProgress(0);
                    setAccumulatedElapsed(0);
                    lastStartRef.current = 0;
                }
            }, 100);
        }
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [isOpen, currentToast, accumulatedElapsed, duration, removeToast]);

    const toggleOverlay = () => {
        setIsOpen((prev) => {
            const newState = !prev;
            if (newState) {
                if (lastStartRef.current) {
                    const elapsed = Date.now() - lastStartRef.current;
                    setAccumulatedElapsed((prevElapsed) => prevElapsed + elapsed);
                    lastStartRef.current = 0;
                }
                if (intervalRef.current) clearInterval(intervalRef.current);
            } else {
                lastStartRef.current = Date.now();
            }
            return newState;
        });
    };

    const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
        if (!containerRef.current?.contains(e.relatedTarget)) {
            setIsOpen(false);
            if (!lastStartRef.current) {
                lastStartRef.current = Date.now();
            }
        }
    };

    const getIcon = () => {
        if (!currentToast) return <IoMdNotifications size={20} className="text-gray-600" />;
        switch (currentToast.type) {
            case 'success':
                return <IoMdCheckmark size={20} className="text-green-500" />;
            case 'error':
                return <IoMdClose size={20} className="text-red-500" />;
            case 'warning':
                return <IoMdAlert size={20} className="text-yellow-500" />;
            case 'info':
            default:
                return <IoMdInformationCircle size={20} className="text-blue-500" />;
        }
    };

    const renderCircularTimer = () => {
        const radius = 16;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (progress / 100) * circumference;

        return (
            <svg width="40" height="40">
                <circle
                    cx="20"
                    cy="20"
                    r={radius}
                    className="stroke-gray-500"
                    strokeWidth="3"
                    fill="none"
                />
                <motion.circle
                    cx="20"
                    cy="20"
                    r={radius}
                    className={`stroke-current ${
                        currentToast
                            ? currentToast.type === 'success'
                                ? 'text-green-500'
                                : currentToast.type === 'error'
                                  ? 'text-red-500'
                                  : currentToast.type === 'warning'
                                    ? 'text-yellow-500'
                                    : 'text-blue-500'
                            : 'text-gray-500'
                    }`}
                    strokeWidth="3"
                    fill="none"
                    strokeDasharray={circumference}
                    animate={{ strokeDashoffset: offset }}
                    transition={{ ease: 'linear', duration: 0.1 }}
                    transform="rotate(-90 20 20)"
                />
            </svg>
        );
    };

    if (!toasts.length) {
        return <></>;
    }

    return (
        <div
            ref={containerRef}
            className="fixed top-4 right-0 z-50"
            tabIndex={0}
            onBlur={handleBlur}>
            {/* Bookmark Tab */}
            <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-white shadow-2xl h-12 w-14 rounded-l-full flex items-center pl-2 cursor-pointer"
                onClick={toggleOverlay}>
                <div className="relative">
                    {renderCircularTimer()}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        {getIcon()}
                    </div>
                </div>
            </motion.div>
            {/* Animate overlay appearance/disappearance with spring transition */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        variants={overlayVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        transition={{
                            type: 'spring',
                            stiffness: 300,
                            damping: 30
                        }}
                        className="absolute top-full right-0 mt-2 bg-white shadow-lg rounded p-4 w-64">
                        {/* <h3 className="font-bold mb-2">Toasts</h3> */}
                        {toasts.length === 0 && <p className="text-gray-500">No active toasts.</p>}
                        {toasts.map((toast) => (
                            <div key={toast.id} className="mb-2 p-2 border rounded">
                                <div className="flex items-center">
                                    <div className="mr-2">
                                        {toast.type === 'success' ? (
                                            <IoMdCheckmark size={16} className="text-green-500" />
                                        ) : toast.type === 'error' ? (
                                            <IoMdClose size={16} className="text-red-500" />
                                        ) : toast.type === 'warning' ? (
                                            <IoMdAlert size={16} className="text-yellow-500" />
                                        ) : (
                                            <IoMdInformationCircle
                                                size={16}
                                                className="text-blue-500"
                                            />
                                        )}
                                    </div>
                                    <div className="text-sm">{toast.message}</div>
                                </div>
                            </div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default BookmarkOverlay;

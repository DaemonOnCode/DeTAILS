import { useEffect, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import debounce from 'lodash/debounce';

const { ipcRenderer } = window.require('electron');

export interface FileViewModalProps {
    filePath: string;
    isViewOpen: boolean;
    closeModal: () => void;
}

const FileViewModal = ({ filePath, isViewOpen, closeModal }: FileViewModalProps) => {
    const [browserViewBounds, setBrowserViewBounds] = useState({
        x: 0,
        y: 0,
        width: 600,
        height: 400
    });
    const modalRef = useRef<HTMLDivElement>(null);

    const calculateBrowserViewBounds = useCallback(() => {
        if (modalRef.current) {
            const modalRect = modalRef.current.getBoundingClientRect();
            const browserViewWidth = Math.max(100, modalRect.width - 120);
            const browserViewHeight = Math.max(100, modalRect.height - 120);
            const browserViewX = modalRect.left + (modalRect.width - browserViewWidth) / 2;
            const browserViewY = modalRect.top + (modalRect.height - browserViewHeight) / 2;
            return {
                x: Math.round(browserViewX),
                y: Math.round(browserViewY),
                width: Math.round(browserViewWidth),
                height: Math.round(browserViewHeight)
            };
        }
        return null;
    }, []);

    const updateBrowserViewBounds = useCallback(() => {
        const bounds = calculateBrowserViewBounds();
        if (bounds) {
            ipcRenderer.invoke('set-file-webview-bounds', bounds);
            setBrowserViewBounds(bounds);
        }
    }, [calculateBrowserViewBounds]);

    const debouncedUpdateBounds = useCallback(debounce(updateBrowserViewBounds, 100), [
        updateBrowserViewBounds
    ]);

    const openBrowserView = async (filePath: string) => {
        try {
            const bounds = calculateBrowserViewBounds();
            if (bounds) {
                const result = await ipcRenderer.invoke('render-file-webview', {
                    filePath,
                    bounds
                });
                console.log('File view opened:', result);
                setBrowserViewBounds(bounds);
            }
        } catch (error) {
            console.error('Failed to open file view:', error);
        }
    };

    const closeBrowserView = async () => {
        await ipcRenderer.invoke('close-file-webview');
        closeModal?.();
        setBrowserViewBounds({ x: 0, y: 0, width: 600, height: 400 });
    };

    useEffect(() => {
        if (isViewOpen) {
            openBrowserView(filePath);
        }
        return () => {
            if (!isViewOpen) {
                closeBrowserView();
            }
        };
    }, [isViewOpen, filePath]);

    useEffect(() => {
        if (!isViewOpen) return;

        updateBrowserViewBounds();

        const handleResize = () => {
            debouncedUpdateBounds();
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            debouncedUpdateBounds.cancel();
        };
    }, [isViewOpen, debouncedUpdateBounds, updateBrowserViewBounds]);

    return (
        <>
            {isViewOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50">
                    <div
                        ref={modalRef}
                        className="relative bg-white rounded-lg shadow-lg p-8 w-4/5 h-4/5 max-w-[90vw] max-h-[90vh]">
                        <button
                            onClick={closeBrowserView}
                            className="absolute top-4 right-4 px-4 py-2 bg-red-500 text-white rounded-full">
                            X
                        </button>
                        <div className="flex flex-col justify-center items-center h-full w-full">
                            <motion.div
                                className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full"
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                role="status"
                                aria-label="Loading"
                            />
                            <div className="mt-4 text-center">
                                <p className="text-lg font-semibold text-gray-800">
                                    Loading File...
                                </p>
                                <p className="text-sm text-gray-600">
                                    Please wait while we load the file.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default FileViewModal;

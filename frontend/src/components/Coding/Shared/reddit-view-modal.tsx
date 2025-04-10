import { useEffect, useState } from 'react';
import { RedditViewModalProps } from '../../../types/Coding/props';
import { useCollectionContext } from '../../../context/collection-context';
import { motion } from 'framer-motion';
const { ipcRenderer } = window.require('electron');

const RedditViewModal = ({
    postLink,
    isViewOpen,
    postText,
    closeModal,
    postId
}: RedditViewModalProps) => {
    const [browserViewBounds, setBrowserViewBounds] = useState({
        x: 0,
        y: 0,
        width: 600,
        height: 400
    });

    const { datasetId } = useCollectionContext();

    useEffect(() => {
        if (isViewOpen) {
            openBrowserView(postLink, postText);
        }

        return () => {
            if (!isViewOpen) {
                closeBrowserView();
            }
        };
    }, [isViewOpen, postLink, postText]); // Added dependencies to prevent unnecessary cleanup

    const openBrowserView = async (postLink: string, postText?: string) => {
        // if (!postLink) return; // Avoid running if postLink is missing
        try {
            const result = await ipcRenderer.invoke(
                'render-reddit-webview',
                postLink,
                postText,
                postId,
                datasetId
            );
            console.log(result);
            setBrowserViewBounds(result);
        } catch (error) {
            console.error('Failed to open browser view:', error);
        }
    };

    const closeBrowserView = async () => {
        await ipcRenderer.invoke('close-reddit-webview');
        closeModal?.();
        setBrowserViewBounds({
            x: 0,
            y: 0,
            width: 800,
            height: 600
        });
    };

    return (
        <>
            {/* Modal Overlay */}
            {isViewOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50">
                    <div
                        className="relative bg-white rounded-lg shadow-lg p-8" // Increased padding
                        style={{
                            width: `${browserViewBounds.width + 120}px`, // Adjusted width to add padding for close button
                            height: `${browserViewBounds.height + 120}px` // Adjusted height to add padding for close button
                        }}>
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
                                    Loading Reddit View...
                                </p>
                                <p className="text-sm text-gray-600">
                                    Please wait while we load the Reddit post.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default RedditViewModal;

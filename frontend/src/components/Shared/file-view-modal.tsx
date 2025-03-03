import { useEffect, useState } from 'react';

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
        width: 800,
        height: 600
    });

    useEffect(() => {
        console.log('File view modal opened:', isViewOpen, filePath);
        if (isViewOpen) {
            openBrowserView(filePath);
        }

        return () => {
            if (!isViewOpen) {
                closeBrowserView();
            }
        };
    }, [isViewOpen, filePath]);

    const openBrowserView = async (filePath: string) => {
        try {
            // Optionally pass additional options. The render-file-webview handler
            // will deduce file type from file extension.
            const result = await ipcRenderer.invoke('render-file-webview', filePath);
            console.log('File view opened:', result);
            // Result may contain the bounds; adjust according to your handler response.
            setBrowserViewBounds(result.bounds || result);
        } catch (error) {
            console.error('Failed to open file view:', error);
        }
    };

    const closeBrowserView = async () => {
        await ipcRenderer.invoke('close-file-webview');
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
            {isViewOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50">
                    <div
                        className="relative bg-white rounded-lg shadow-lg p-8"
                        style={{
                            width: `${browserViewBounds.width + 120}px`,
                            height: `${browserViewBounds.height + 120}px`
                        }}>
                        <button
                            onClick={closeBrowserView}
                            className="absolute top-4 right-4 px-4 py-2 bg-red-500 text-white rounded-full">
                            X
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default FileViewModal;

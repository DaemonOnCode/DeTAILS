// src/components/Shared/interview-view-modal.tsx

import { useEffect, useState, useRef, useCallback } from 'react';
import { useWorkspaceContext } from '../../context/workspace-context';
import { motion } from 'framer-motion';
import debounce from 'lodash/debounce';
const { ipcRenderer } = window.require('electron');

export interface InterviewViewModalProps {
    fileId: string;
    isOpen: boolean;
    closeModal: () => void;
}

const InterviewViewModal = ({ fileId, isOpen, closeModal }: InterviewViewModalProps) => {
    const [bounds, setBounds] = useState({ x: 0, y: 0, width: 800, height: 600 });
    const innerRef = useRef<HTMLDivElement>(null);
    const { currentWorkspace } = useWorkspaceContext();

    const calcBounds = useCallback(() => {
        if (!innerRef.current) return null;
        const rect = innerRef.current.getBoundingClientRect();
        const w = Math.max(200, rect.width - 100);
        const h = Math.max(200, rect.height - 100);
        return {
            x: Math.round(rect.left + (rect.width - w) / 2),
            y: Math.round(rect.top + (rect.height - h) / 2),
            width: Math.round(w),
            height: Math.round(h)
        };
    }, []);

    const updateBounds = useCallback(() => {
        const b = calcBounds();
        if (b) {
            ipcRenderer.invoke('set-interview-webview-bounds', b);
            setBounds(b);
        }
    }, [calcBounds]);

    const debounced = useCallback(debounce(updateBounds, 100), [updateBounds]);

    const openWebview = async () => {
        const b = calcBounds();
        if (!b) return;

        try {
            await ipcRenderer.invoke('render-interview-webview', fileId, b);
            setBounds(b);
        } catch (err) {
            console.error('Failed to open interview view:', err);
        }
    };

    const closeWebview = async () => {
        await ipcRenderer.invoke('close-interview-webview');
        setBounds({ x: 0, y: 0, width: 800, height: 600 });
        closeModal();
    };

    useEffect(() => {
        if (isOpen) openWebview();
        return () => {
            if (!isOpen) closeWebview();
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        updateBounds();
        window.addEventListener('resize', debounced);
        return () => {
            window.removeEventListener('resize', debounced);
            debounced.cancel();
        };
    }, [isOpen, debounced, updateBounds]);

    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div
                ref={innerRef}
                className="relative bg-white rounded-lg shadow-xl p-6 w-4/5 h-4/5 max-w-[90vw] max-h-[90vh]">
                <button
                    onClick={closeWebview}
                    className="absolute top-4 right-4 text-white bg-red-600 rounded-full px-3 py-1">
                    ×
                </button>
                <div className="flex flex-col items-center justify-center h-full w-full">
                    <motion.div
                        className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    />
                    <p className="text-center text-gray-700 mt-4">Loading interview…</p>
                </div>
            </div>
        </div>
    );
};

export default InterviewViewModal;

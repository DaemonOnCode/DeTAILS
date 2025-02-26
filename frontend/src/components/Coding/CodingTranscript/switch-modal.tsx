import React from 'react';

interface SwitchModalProps {
    title?: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
}

const SwitchModal: React.FC<SwitchModalProps> = ({
    title = 'Alert',
    message,
    confirmLabel = 'OK',
    cancelLabel = 'Cancel',
    onConfirm,
    onCancel
}) => {
    return (
        <div className="fixed inset-0 flex items-center justify-center z-50">
            {/* Overlay */}
            <div className="absolute inset-0 bg-gray-900 opacity-50"></div>
            {/* Modal Container */}
            <div className="relative bg-white rounded-lg shadow-lg p-6 max-w-md w-full z-50">
                {title && <h3 className="text-xl font-bold mb-4">{title}</h3>}
                <div className="mb-6 text-gray-700">{message}</div>
                <div className="flex justify-end space-x-4">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400">
                        {cancelLabel}
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SwitchModal;

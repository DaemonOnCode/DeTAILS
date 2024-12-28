import React, { FC } from 'react';
import { TopToolbarProps } from '../../../types/Coding/props';

const TopToolbar: FC<TopToolbarProps> = ({
    selectedPost,
    setIsAddCodeModalOpen,
    setIsHighlightModalOpen,
    setIsEditCodeModalOpen,
    setIsDeleteCodeModalOpen
}) => (
    <div className="bg-gray-200 p-3 border-b flex items-center space-x-4">
        <button
            className={`px-4 py-2 rounded ${
                selectedPost
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-400 text-gray-200 cursor-not-allowed'
            }`}
            onClick={() => selectedPost && setIsAddCodeModalOpen(true)}
            disabled={!selectedPost}>
            Add Code
        </button>
        <button
            className={`px-4 py-2 rounded ${
                selectedPost
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-400 text-gray-200 cursor-not-allowed'
            }`}
            onClick={() => selectedPost && setIsEditCodeModalOpen(true)}
            disabled={!selectedPost}>
            Edit Code
        </button>
        <button
            className={`px-4 py-2 rounded ${
                selectedPost
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-400 text-gray-200 cursor-not-allowed'
            }`}
            onClick={() => selectedPost && setIsDeleteCodeModalOpen(true)}
            disabled={!selectedPost}>
            Delete Code
        </button>
        <button
            className={`px-4 py-2 rounded ${
                selectedPost
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-400 text-gray-200 cursor-not-allowed'
            }`}
            onClick={() => selectedPost && setIsHighlightModalOpen(true)}
            disabled={!selectedPost}>
            Highlight
        </button>
        <button
            className={`px-4 py-2 rounded ${
                selectedPost
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-400 text-gray-200 cursor-not-allowed'
            }`}
            onClick={() => selectedPost && setIsHighlightModalOpen(true)}
            disabled={!selectedPost}>
            Edit Highlight
        </button>
        <button
            className={`px-4 py-2 rounded ${
                selectedPost
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-400 text-gray-200 cursor-not-allowed'
            }`}
            onClick={() => selectedPost && setIsHighlightModalOpen(true)}
            disabled={!selectedPost}>
            Delete Highlight
        </button>
    </div>
);

export default TopToolbar;

import React, { FC, useState, useRef } from 'react';
import { TopToolbarProps } from '../../../types/Coding/props';
import { FaCode, FaHighlighter, FaBook } from 'react-icons/fa'; // Added FaBook for Codebook icon

const TopToolbar: FC<TopToolbarProps> = ({
    selectedPost,
    setIsAddCodeModalOpen,
    setIsHighlightModalOpen,
    setIsEditCodeModalOpen,
    setIsDeleteCodeModalOpen,
    setIsEditHighlightCodeModalOpen,
    setIsDeleteHighlightCodeModalOpen,
    showCodebookButton = false, // Default to false if not provided
    showCodebook = false, // Default to false if not provided
    onShowCodebook
}) => {
    const [isCodeDropdownOpen, setIsCodeDropdownOpen] = useState(false);
    const [isHighlightDropdownOpen, setIsHighlightDropdownOpen] = useState(false);
    const codeDropdownRef = useRef<HTMLDivElement>(null);
    const highlightDropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown on click outside
    const handleBlur = (
        event: React.FocusEvent<HTMLDivElement>,
        setter: (value: boolean) => void
    ) => {
        if (
            event.relatedTarget &&
            (codeDropdownRef.current?.contains(event.relatedTarget) ||
                highlightDropdownRef.current?.contains(event.relatedTarget))
        ) {
            return; // Don't close if moving focus inside dropdown
        }
        setter(false);
    };

    return (
        <div className="bg-gray-200 p-3 border-b flex items-center space-x-6">
            {/* Code Actions Dropdown */}
            <div
                className="relative"
                tabIndex={0}
                ref={codeDropdownRef}
                onBlur={(e) => handleBlur(e, setIsCodeDropdownOpen)}>
                <button
                    className="flex items-center px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    onClick={() => setIsCodeDropdownOpen(!isCodeDropdownOpen)}>
                    <FaCode className="mr-2" /> Code Actions ▼
                </button>
                {isCodeDropdownOpen && (
                    <ul className="absolute mt-2 w-48 bg-white border rounded shadow-lg z-50">
                        <li
                            className={`px-4 py-2 hover:bg-gray-100 ${
                                selectedPost ? 'cursor-pointer' : 'text-gray-400 cursor-not-allowed'
                            }`}
                            onClick={() => selectedPost && setIsAddCodeModalOpen(true)}>
                            Add Code
                        </li>
                        <li
                            className={`px-4 py-2 hover:bg-gray-100 ${
                                selectedPost ? 'cursor-pointer' : 'text-gray-400 cursor-not-allowed'
                            }`}
                            onClick={() => selectedPost && setIsEditCodeModalOpen(true)}>
                            Edit Code
                        </li>
                        <li
                            className={`px-4 py-2 hover:bg-red-100 text-red-500 ${
                                selectedPost ? 'cursor-pointer' : 'text-gray-400 cursor-not-allowed'
                            }`}
                            onClick={() => selectedPost && setIsDeleteCodeModalOpen(true)}>
                            Delete Code
                        </li>
                    </ul>
                )}
            </div>

            {/* Highlight Actions Dropdown */}
            <div
                className="relative"
                tabIndex={0}
                ref={highlightDropdownRef}
                onBlur={(e) => handleBlur(e, setIsHighlightDropdownOpen)}>
                <button
                    className="flex items-center px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    onClick={() => setIsHighlightDropdownOpen(!isHighlightDropdownOpen)}>
                    <FaHighlighter className="mr-2" /> Highlight Actions ▼
                </button>
                {isHighlightDropdownOpen && (
                    <ul className="absolute mt-2 w-48 bg-white border rounded shadow-lg z-50">
                        <li
                            className={`px-4 py-2 hover:bg-gray-100 ${
                                selectedPost ? 'cursor-pointer' : 'text-gray-400 cursor-not-allowed'
                            }`}
                            onClick={() => selectedPost && setIsHighlightModalOpen(true)}>
                            Add Highlight
                        </li>
                        <li
                            className={`px-4 py-2 hover:bg-gray-100 ${
                                selectedPost ? 'cursor-pointer' : 'text-gray-400 cursor-not-allowed'
                            }`}
                            onClick={() => selectedPost && setIsEditHighlightCodeModalOpen(true)}>
                            Edit Highlight
                        </li>
                        <li
                            className={`px-4 py-2 hover:bg-red-100 text-red-500 ${
                                selectedPost ? 'cursor-pointer' : 'text-gray-400 cursor-not-allowed'
                            }`}
                            onClick={() => selectedPost && setIsDeleteHighlightCodeModalOpen(true)}>
                            Delete Highlight
                        </li>
                    </ul>
                )}
            </div>

            {/* Show Codebook Button (conditionally rendered) */}
            {showCodebookButton && (
                <button
                    className="flex items-center px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                    onClick={onShowCodebook}>
                    <FaBook className="mr-2" /> {!showCodebook ? 'Show Codebook' : 'Hide Codebook'}
                </button>
            )}
        </div>
    );
};

export default TopToolbar;

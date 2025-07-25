import React, { FC, useState, useRef } from 'react';
import { TopToolbarProps } from '../../../types/Coding/props';
import { FaCode, FaHighlighter, FaBook } from 'react-icons/fa';

const TopToolbar: FC<TopToolbarProps> = ({
    selectedPost,
    setIsAddCodeModalOpen,
    selectionRefArray,
    setIsHighlightModalOpen,
    setIsEditCodeModalOpen,
    setIsDeleteCodeModalOpen,
    setIsEditHighlightCodeModalOpen,
    setIsDeleteHighlightCodeModalOpen,
    showCodebookButton = false,
    showCodebook = false,
    onShowCodebook,
    showDoneButton,
    onDoneClick = () => {},
    isDone
}) => {
    const [isCodeDropdownOpen, setIsCodeDropdownOpen] = useState(false);
    const [isHighlightDropdownOpen, setIsHighlightDropdownOpen] = useState(false);
    const codeDropdownRef = useRef<HTMLDivElement>(null);
    const highlightDropdownRef = useRef<HTMLDivElement>(null);

    const disableAddHighlightModal = !selectionRefArray.some(
        (ref) => !!ref.current?.toString().trim().length
    );

    const handleBlur = (
        event: React.FocusEvent<HTMLDivElement>,
        setter: (value: boolean) => void
    ) => {
        if (
            event.relatedTarget &&
            (codeDropdownRef.current?.contains(event.relatedTarget) ||
                highlightDropdownRef.current?.contains(event.relatedTarget))
        ) {
            return;
        }
        setter(false);
    };

    return (
        <div
            className="bg-gray-200 p-3 border-b flex items-center space-x-6"
            id="transcript-toolbar">
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
                            title={
                                disableAddHighlightModal
                                    ? 'Highlight text to add new highlight'
                                    : 'Add highlight'
                            }
                            className={`px-4 py-2 hover:bg-gray-100 ${
                                selectedPost && !disableAddHighlightModal
                                    ? 'cursor-pointer'
                                    : 'text-gray-400 cursor-not-allowed'
                            }`}
                            onClick={() =>
                                selectedPost &&
                                !disableAddHighlightModal &&
                                setIsHighlightModalOpen(true)
                            }>
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

            {showCodebookButton && (
                <button
                    className="flex items-center px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                    onClick={onShowCodebook}>
                    <FaBook className="mr-2" /> {!showCodebook ? 'Show Codes' : 'Hide Codes'}
                </button>
            )}
            {showDoneButton && (
                <button
                    className={`px-4 py-2  rounded text-white ${!isDone ? 'bg-green-500  hover:bg-green-600' : 'bg-blue-500 hover:bg-blue-600'}`}
                    onClick={onDoneClick}>
                    {isDone ? 'Mark as Undone' : 'Mark as Done'}
                </button>
            )}
        </div>
    );
};

export default TopToolbar;

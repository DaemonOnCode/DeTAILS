import { FC, useRef } from 'react';
import { useIntersectionObserver } from '../../../hooks/Shared/use-intersection-observer';
import DataRow from './data-row';
import { IQECResponse, IQECTResponse, IQECTTyResponse } from '../../../types/Coding/shared';

interface ObservableTBodyProps {
    pid: string;
    rowItems: (IQECResponse | IQECTResponse | IQECTTyResponse)[];
    totalColumns: number;
    editIndex: string | null;
    editableRow: any;
    handleInputChange: (field: string, value: string) => void;
    handleMark: (index: string, isMarked?: boolean) => void;
    handleSaveEdit: () => void;
    handleCancelEdit: () => void;
    review: boolean;
    showThemes?: boolean;
    showCoderType?: boolean;
    onViewTranscript: (postId: string | null) => void;
    conflictingResponses: IQECResponse[];
}

const ObservableTBody: FC<ObservableTBodyProps> = ({
    pid,
    rowItems,
    totalColumns,
    editIndex,
    editableRow,
    handleInputChange,
    handleMark,
    handleSaveEdit,
    handleCancelEdit,
    review,
    showThemes,
    showCoderType,
    onViewTranscript,
    conflictingResponses
}) => {
    const tableRef = useRef<HTMLTableSectionElement>(null);
    const isVisible = useIntersectionObserver(tableRef, {
        visibleThreshold: 0.01, // Trigger when 1% is in the expanded viewport
        invisibleThreshold: 0.001, // Hide when less than 0.1% is visible
        rootMargin: '300px 0px 300px 0px', // Expand viewport by 300px top and bottom
        threshold: [0.001, 0.01]
    });

    // Adjust these based on actual measured heights (e.g., via browser inspection)
    const rowHeight = 60; // Slightly overestimate to prevent jumps
    const headerHeight = 50; // Match typical header height
    const totalHeight = headerHeight + rowItems.length * rowHeight;

    return (
        <tbody ref={tableRef} style={{ height: isVisible ? 'auto' : `${totalHeight}px` }}>
            {isVisible ? (
                <>
                    <tr
                        className={`sticky ${review ? 'top-[40px]' : 'top-[100px]'} border-b-2 border-gray-300 bg-gray-50 z-20`}>
                        <td
                            colSpan={totalColumns}
                            className="p-2 font-semibold bg-gray-50 border border-gray-300 outline outline-1 outline-gray-300">
                            <button
                                onClick={() => onViewTranscript(pid)}
                                className="text-blue-500 underline">
                                Post ID: {pid}
                            </button>
                        </td>
                    </tr>
                    {rowItems.map((row) => (
                        <DataRow
                            key={row.id}
                            row={row}
                            editIndex={editIndex}
                            editableRow={editableRow}
                            handleInputChange={handleInputChange}
                            handleMark={handleMark}
                            handleSaveEdit={handleSaveEdit}
                            handleCancelEdit={handleCancelEdit}
                            review={review}
                            showThemes={showThemes}
                            showCoderType={showCoderType}
                            onViewTranscript={onViewTranscript}
                            conflictingResponses={conflictingResponses}
                        />
                    ))}
                </>
            ) : (
                <tr>
                    <td colSpan={totalColumns} style={{ height: `${totalHeight}px` }}></td>
                </tr>
            )}
        </tbody>
    );
};

export default ObservableTBody;

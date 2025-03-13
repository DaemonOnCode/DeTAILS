import { FC } from 'react';
import { TooltipMessages } from '../../constants/Shared';

type PaginationControlsProps = {
    currentPage: number;
    totalPages: number;
    onNext: () => void;
    onPrevious: () => void;

    locked: boolean; // is dataset locked?
    onLock: () => void; // lock the dataset
    onUnlock: () => void; // unlock the dataset (NEW)
    selectedCount: number; // how many are selected
};

const PaginationControls: FC<PaginationControlsProps> = ({
    currentPage,
    totalPages,
    onNext,
    onPrevious,

    locked,
    onLock,
    onUnlock,
    selectedCount
}) => {
    return (
        <div className="flex items-center justify-between mt-4">
            {/* Previous button */}
            <button
                onClick={onPrevious}
                title={TooltipMessages.Previous}
                disabled={currentPage === 1}
                className={`px-4 py-2 rounded ${
                    currentPage === 1
                        ? 'bg-gray-300 cursor-not-allowed'
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}>
                Previous
            </button>

            {/* Middle content */}
            <div className="flex items-center space-x-4">
                <p>{selectedCount} posts selected</p>

                {/* If locked, show "Unlock" button; if unlocked, show "Lock" button */}
                {locked ? (
                    <button
                        onClick={onUnlock}
                        className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">
                        Unlock Dataset
                    </button>
                ) : (
                    <button
                        onClick={onLock}
                        className={`px-4 py-2 rounded ${
                            selectedCount > 0
                                ? 'bg-red-500 text-white hover:bg-red-600'
                                : 'bg-gray-300 cursor-not-allowed'
                        }`}
                        disabled={selectedCount === 0}>
                        Lock Dataset
                    </button>
                )}
            </div>

            {/* Next button */}
            <button
                onClick={onNext}
                title={TooltipMessages.Next}
                disabled={currentPage === totalPages}
                className={`px-4 py-2 rounded ${
                    currentPage === totalPages
                        ? 'bg-gray-300 cursor-not-allowed'
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}>
                Next
            </button>
        </div>
    );
};

export default PaginationControls;

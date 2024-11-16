import React from "react";

type PaginationControlsProps = {
    currentPage: number;
    totalPages: number;
    onNext: () => void;
    onPrevious: () => void;
};

const PaginationControls: React.FC<PaginationControlsProps> = ({ currentPage, totalPages, onNext, onPrevious }) => (
    <div className="flex justify-between mt-4">
        <button
            onClick={onPrevious}
            disabled={currentPage === 1}
            className={`px-4 py-2 rounded ${currentPage === 1 ? "bg-gray-300 cursor-not-allowed" : "bg-blue-500 text-white hover:bg-blue-600"}`}
        >
            Previous
        </button>
        <span className="px-4 py-2">
            Page {currentPage} of {totalPages}
        </span>
        <button
            onClick={onNext}
            disabled={currentPage === totalPages}
            className={`px-4 py-2 rounded ${currentPage === totalPages ? "bg-gray-300 cursor-not-allowed" : "bg-blue-500 text-white hover:bg-blue-600"}`}
        >
            Next
        </button>
    </div>
);

export default PaginationControls;

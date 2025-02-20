import React from 'react';
import { SetState } from '../../../types/Coding/shared';

interface ReviewToggleProps {
    review: boolean;
    setReview: SetState<boolean>;
}

const ReviewToggle: React.FC<ReviewToggleProps> = ({ review, setReview }) => {
    return (
        <div className="flex text-center justify-center items-center p-2 lg:p-4 gap-x-2">
            <span
                className={`cursor-pointer select-none ${
                    review ? 'font-bold text-blue-500' : 'text-gray-700'
                }`}
                onClick={() => setReview(true)}>
                Review Mode
            </span>
            <label
                htmlFor="toggleReview"
                className="relative inline-block w-6 lg:w-12 h-3 lg:h-6 cursor-pointer">
                <input
                    id="toggleReview"
                    type="checkbox"
                    className="sr-only"
                    checked={review}
                    onChange={() => setReview((prev) => !prev)}
                />
                <div className="block bg-gray-300 w-6 lg:w-12 h-3 lg:h-6 rounded-full"></div>
                <div
                    className={`dot absolute left-0.5 lg:left-1 top-0.5 lg:top-1 bg-white w-2 lg:w-4 h-2 lg:h-4 rounded-full transition-transform ${
                        !review ? 'translate-x-3 lg:translate-x-6 bg-blue-500' : ''
                    }`}></div>
            </label>
            <span
                className={`cursor-pointer select-none ${
                    !review ? 'font-bold text-blue-500' : 'text-gray-700'
                }`}
                onClick={() => setReview(false)}>
                Edit Mode
            </span>
        </div>
    );
};

export default ReviewToggle;

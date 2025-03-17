import React from 'react';
import { PullProgressProps } from '../../../types/Settings/props';

const PullProgress: React.FC<PullProgressProps> = ({ pullLoading, pullProgress, pullStatus }) => {
    if (!pullLoading) return null;
    return (
        <div className="mt-4">
            <p>
                <strong>{pullStatus}</strong> ({Math.floor(pullProgress)}%)
            </p>
            <div className="w-full bg-gray-200 rounded">
                <div
                    className="bg-blue-500 text-xs leading-none py-1 text-center text-white rounded"
                    style={{ width: `${pullProgress}%` }}>
                    {Math.floor(pullProgress)}%
                </div>
            </div>
        </div>
    );
};

export default PullProgress;

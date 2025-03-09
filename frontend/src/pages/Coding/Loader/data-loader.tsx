import React from 'react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';

const dotVariants = {
    animate: (delay: number) => ({
        y: [0, -10, 0],
        transition: {
            duration: 0.6,
            repeat: Infinity,
            ease: 'easeInOut',
            delay
        }
    })
};

const DataLoading: React.FC = () => {
    const [searchParams] = useSearchParams();
    const newText = searchParams.get('text');

    return (
        <div className="flex flex-col items-center justify-center min-h-page w-full">
            <div className="mb-4 px-6 py-3 text-3xl font-bold">{newText ?? 'Loading data'}</div>
            <div className="flex space-x-2">
                <motion.span
                    custom={0}
                    className="w-4 h-4 bg-blue-500 rounded-full"
                    variants={dotVariants}
                    animate="animate"
                />
                <motion.span
                    custom={0.2}
                    className="w-4 h-4 bg-blue-500 rounded-full"
                    variants={dotVariants}
                    animate="animate"
                />
                <motion.span
                    custom={0.4}
                    className="w-4 h-4 bg-blue-500 rounded-full"
                    variants={dotVariants}
                    animate="animate"
                />
            </div>
        </div>
    );
};

export default DataLoading;

import { FC } from 'react';
import { motion } from 'framer-motion';

const ModelLoader: FC<{ message: string }> = ({ message }) => {
    const messageArgs = message.split('|');

    if (messageArgs.length > 1 && messageArgs[0] === 'preprocessing') {
        return (
            <div className="flex flex-col gap-6 justify-center items-center h-full w-full">
                {/* Spinner */}
                <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900"></div>

                {/* Message */}
                <p className="text-center text-gray-900 capitalize">
                    {messageArgs[0]} {messageArgs[1]}
                </p>

                {/* Loading Bar */}
                <div className="w-3/4 h-4 bg-gray-300 rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-gray-900"
                        initial={{ width: '0%' }}
                        animate={{ width: `${messageArgs[2]}%` }}
                        transition={{ duration: 0.5 }}
                    />
                </div>

                {/* Percentage Display */}
                <p className="text-gray-600">{messageArgs[2]}%</p>
            </div>
        );
    }
    return (
        <div className="flex flex-col gap-6 justify-center items-center h-full w-full">
            <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900"></div>
            <p className="text-center text-gray-900 capitalize">{message}...</p>
        </div>
    );
};

export default ModelLoader;

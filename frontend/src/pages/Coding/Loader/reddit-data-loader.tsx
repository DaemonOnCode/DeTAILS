import { useState, useEffect } from 'react';
import { useWebSocket } from '../../../context/websocket-context';
import { motion } from 'framer-motion';

const RedditParserLoader = () => {
    const [lastMessage, setLastMessage] = useState('Waiting for updates...');
    const { registerCallback, unregisterCallback } = useWebSocket();

    useEffect(() => {
        registerCallback('reddit-parser', handleWebSocketMessage);
        return () => {
            unregisterCallback('reddit-parser');
        };
    }, []);

    const handleWebSocketMessage = (message) => {
        setLastMessage(message);
    };

    return (
        <div className="flex items-center justify-center min-h-page">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="p-10 bg-white rounded-2xl shadow-xl flex flex-col items-center max-w-lg w-full border border-gray-200">
                <h2 className="text-4xl font-bold text-gray-900 mb-6 tracking-wide">
                    Parsing Reddit Dataset
                </h2>
                <motion.p
                    key={lastMessage}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="text-xl text-gray-700 mb-8 text-center">
                    {lastMessage}
                </motion.p>
                <div className="relative flex items-center justify-center">
                    <div className="relative w-16 h-16">
                        {[...Array(8)].map((_, i) => (
                            <div
                                key={i}
                                className="absolute top-0 left-0 w-16 h-16"
                                style={{
                                    transform: `rotate(${i * 45}deg)`
                                }}>
                                <div
                                    className="w-4 h-4 bg-blue-600 rounded-full opacity-75"
                                    style={{
                                        animation: `pulse 1.5s infinite`,
                                        animationDelay: `${i * 0.1}s`
                                    }}></div>
                            </div>
                        ))}
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default RedditParserLoader;

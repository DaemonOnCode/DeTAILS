import { FC } from 'react';
import Sidebar from './sidebar';
import Topbar from './topbar'; // Import the Topbar component
import { ILayout } from '../../types/Coding/shared';
import { useAuth } from '../../context/auth_context';
import { useWebSocket } from '../../context/websocket_context';
import { motion } from 'framer-motion';

export const Layout: FC<ILayout> = ({ children }) => {
    const { serviceStarting } = useWebSocket();
    const { remoteProcessing } = useAuth();
    console.log('Layout remoteProcessing:', remoteProcessing, 'serviceStarting:', serviceStarting);

    if (!remoteProcessing && serviceStarting) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen">
                <div className="flex space-x-4 mb-6">
                    {/* Animated Loader */}
                    <motion.div
                        className="h-5 w-5 bg-black rounded-full"
                        animate={{
                            y: [0, -20, 0] // Bouncing animation
                        }}
                        transition={{
                            duration: 0.6,
                            repeat: Infinity,
                            repeatType: 'loop',
                            delay: 0
                        }}
                    />
                    <motion.div
                        className="h-5 w-5 bg-black rounded-full"
                        animate={{
                            y: [0, -20, 0] // Bouncing animation
                        }}
                        transition={{
                            duration: 0.6,
                            repeat: Infinity,
                            repeatType: 'loop',
                            delay: 0.2
                        }}
                    />
                    <motion.div
                        className="h-5 w-5 bg-black rounded-full"
                        animate={{
                            y: [0, -20, 0] // Bouncing animation
                        }}
                        transition={{
                            duration: 0.6,
                            repeat: Infinity,
                            repeatType: 'loop',
                            delay: 0.4
                        }}
                    />
                </div>
                <h1 className="text-3xl font-bold mb-4">Starting Services...</h1>
                <p className="text-lg text-gray-600">
                    Please wait while we initialize the backend services. This may take a few
                    moments.
                </p>
            </div>
        );
    } else {
        return (
            <div>
                {/* Topbar */}
                <Topbar />
                <div className="flex w-full relative">
                    {/* Sidebar */}
                    <Sidebar />

                    {/* Main Content Wrapper */}
                    <div className="flex flex-col w-full pl-48 min-h-page">
                        {/* Main Content Area */}
                        <div className="p-6 h-full overflow-hidden">{children}</div>
                    </div>
                </div>
            </div>
        );
    }
};

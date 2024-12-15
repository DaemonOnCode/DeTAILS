import { FC, createContext, useContext, useEffect, useRef, useState } from 'react';
import { ILayout } from '../types/Coding/shared';
import { ToastContainer, toast } from 'react-toastify';
const { ipcRenderer } = window.require('electron');

type CallbackFn = (message: string) => void;


// Create the WebSocket context
const WebSocketContext = createContext({
    registerCallback: (callback: CallbackFn) => {},
    unregisterCallback: (callback: CallbackFn) => {},
});


// WebSocket Provider Component
export const WebSocketProvider: FC<ILayout> = ({ children }) => {
    const [messageCallbacks, setMessageCallbacks] = useState<CallbackFn[]>([])

    // Register a callback
    const registerCallback = (callback: CallbackFn) => {
        messageCallbacks.push(callback);
    };

    // Unregister a callback
    const unregisterCallback = (callback: CallbackFn) => {
        setMessageCallbacks((prev)=>prev.filter((cb) => cb !== callback));
    };
    const handleMessage = (event: any, message: string) => {
        // console.log('Received WebSocket message:', message, event);
        // Notify all registered callbacks
        if(message.startsWith("ERROR:")){
            toast.error(message);
            return;
        }
        if(message.startsWith("WARNING:")){
            toast.warning(message);
            return;
        }
        messageCallbacks.forEach((callback) => callback(message));
    };
    
    useEffect(() => {
        // Listen for WebSocket messages
        ipcRenderer.invoke('connect-ws', "").then(() => {
            ipcRenderer.on('ws-message', handleMessage);
            ipcRenderer.on('ws-close', () => {
                toast.warning("WebSocket connection closed. Reconnecting.");
                ipcRenderer.invoke('connect-ws', "");
            });
        });

        // Cleanup on unmount
        return () => {
            ipcRenderer.removeListener('ws-message', handleMessage);
            ipcRenderer.invoke('disconnect-ws', "").then(() => {
                console.log('Disconnected from WebSocket');
            });
        };
    }, []);

    return (
        <WebSocketContext.Provider
            value={{
                registerCallback,
                unregisterCallback,
            }}
        >
            <ToastContainer />
            {children}
        </WebSocketContext.Provider>
    );
};

// Custom hook to use WebSocket context
export const useWebSocket = () => {
    return useContext(WebSocketContext);
};

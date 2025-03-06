import React, {
    FC,
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState
} from 'react';
import { toast } from 'react-toastify';
import { useAuth } from './auth-context';
import { ILayout } from '../types/Coding/shared';

const { ipcRenderer } = window.require('electron');

type CallbackFn = (message: string) => void;

const WebSocketContext = createContext({
    registerCallback: (event: string, callback: CallbackFn) => {},
    unregisterCallback: (event: string) => {},
    serviceStarting: true
});

const WebSocketSingleton = (() => {
    let isInitialized = false;
    let retryCount = 0;
    let checkBackend = false;

    const initialize = (
        handleMessage: (event: any, message: string) => void,
        monitorWebSocketStatus: (checkBackend: boolean) => void,
        localProcessing: boolean
    ) => {
        checkBackend = localProcessing;
        if (isInitialized) return;

        ipcRenderer.removeAllListeners('ws-message');
        ipcRenderer.on('ws-message', handleMessage);

        monitorWebSocketStatus(checkBackend);

        isInitialized = true;
        console.log('WebSocket singleton initialized');
    };

    const attemptReconnect = (initiateWebSocketConnection: () => void) => {
        retryCount += 1;
        if (retryCount > 10) {
            // toast.error('WebSocket server is offline. Max retries reached.');
            return;
        }
        const retryDelay = Math.pow(2, retryCount) * 1000; // Exponential backoff
        console.log(`Reconnecting WebSocket in ${retryDelay / 1000}s...`);
        setTimeout(initiateWebSocketConnection, retryDelay);
    };

    const deinitialize = async () => {
        console.log('Deinitializing WebSocket Singleton...');
        // Remove all event listeners related to WebSocket
        ipcRenderer.removeAllListeners('ws-message');
        ipcRenderer.removeAllListeners('ws-connected');
        ipcRenderer.removeAllListeners('ws-closed');
        ipcRenderer.removeAllListeners('service-started');
        ipcRenderer.removeAllListeners('service-stopped');

        // Reset internal state
        retryCount = 0;
        isInitialized = false;

        // Stop WebSocket connection
        try {
            await ipcRenderer.invoke('disconnect-ws');
        } catch (error) {
            console.error('Failed to disconnect WebSocket:', error);
        }

        console.log('WebSocket Singleton successfully deinitialized.');
    };

    return {
        isInitialized,
        initialize,
        resetRetryCount: () => {
            retryCount = 0;
        },
        attemptReconnect,
        deinitialize
    };
})();

export const WebSocketProvider: FC<ILayout> = ({ children }) => {
    const { remoteProcessing, isAuthenticated, user } = useAuth();
    const messageCallbacks = useRef<{ [key: string]: CallbackFn }>({});
    const [serviceStarting, setServiceStarting] = useState(true);
    const lastPingRef = useRef<Date | null>(null);
    const pingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const registerCallback = (event: string, callback: CallbackFn) => {
        if (!messageCallbacks.current[event]) {
            messageCallbacks.current[event] = callback;
        }
    };

    const unregisterCallback = (event: string) => {
        delete messageCallbacks.current[event];
    };

    const handleMessage = (event: any, message: string) => {
        if (message === 'ping') {
            lastPingRef.current = new Date();
            resetPingTimeout();
            return;
        }

        Object.values(messageCallbacks.current).forEach((callback) => callback(message));
    };

    const resetPingTimeout = () => {
        if (pingTimeoutRef.current) {
            clearTimeout(pingTimeoutRef.current);
        }

        pingTimeoutRef.current = setTimeout(() => {
            const now = new Date();
            if (lastPingRef.current && now.getTime() - lastPingRef.current.getTime() > 60000) {
                toast.error('No response from backend in the last 60 seconds.');
            }
        }, 60000);
    };

    const initiateWebSocketConnection = () => {
        ipcRenderer.invoke('connect-ws', '').catch((error: any) => {
            console.error('Failed to initiate WebSocket connection:', error);
        });
    };

    const monitorWebSocketStatus = useCallback(
        (checkBackend = false) => {
            ipcRenderer.on('ws-connected', () => {
                console.log('WebSocket connected');
                // toast.success('Websocket connection established.');
                WebSocketSingleton.resetRetryCount();
                lastPingRef.current = new Date();
                resetPingTimeout();
                if (checkBackend) {
                    setServiceStarting(false);
                }
            });

            ipcRenderer.on('ws-closed', () => {
                // console.log('WebSocket closed', isAuthenticated);
                if (!isAuthenticated) return;
                // toast.warning('WebSocket disconnected. Attempting to reconnect...');
                WebSocketSingleton.attemptReconnect(initiateWebSocketConnection);
            });
        },
        [isAuthenticated]
    );

    const pollBackendServices = () => {
        console.log('Polling backend services...');
        setServiceStarting(true);
        initiateWebSocketConnection();

        const handleServiceStarted = (event: any, serviceName: string) => {
            console.log('Service started:', serviceName);
            if (serviceName === 'backend') {
                console.log('Backend service started');
                toast.info('Backend service started');
            }
            initiateWebSocketConnection();
        };

        const handleServiceStopped = (event: any, serviceName: string) => {
            console.log('Service stopped:', serviceName);
            if (serviceName === 'backend') {
                console.log('Backend service stopped');
                toast.error('Backend service stopped. Restart the application.');
            }
        };

        ipcRenderer.on('service-started', handleServiceStarted);
        ipcRenderer.on('service-stopped', handleServiceStopped);

        return () => {
            // WebSocketSingleton.deinitialize();
            ipcRenderer.removeListener('service-started', handleServiceStarted);
            ipcRenderer.removeListener('service-stopped', handleServiceStopped);
        };
    };

    useEffect(() => {
        console.log('Auth changed:', isAuthenticated, user);
        if (!isAuthenticated) {
            console.log('User logged out. De-initializing WebSocket...');

            //
            WebSocketSingleton.deinitialize();

            setServiceStarting(false);
        }
    }, [isAuthenticated]);

    useEffect(() => {
        WebSocketSingleton.initialize(handleMessage, monitorWebSocketStatus, !remoteProcessing);

        let cleanup = () => {
            console.log('User logged out. De-initializing WebSocket...');
            // setServiceStarting(false);
        };
        if (remoteProcessing) {
            setServiceStarting(false);
            initiateWebSocketConnection();
        } else {
            cleanup = pollBackendServices();
        }

        return () => {
            console.log('WebSocketProvider cleanup');
            cleanup();
            if (!isAuthenticated) {
                WebSocketSingleton.deinitialize();
            }
            setServiceStarting(false);
            if (pingTimeoutRef.current) clearTimeout(pingTimeoutRef.current);
            ipcRenderer.invoke('disconnect-ws');
        };
    }, [remoteProcessing]);

    return (
        <WebSocketContext.Provider
            value={{
                registerCallback,
                unregisterCallback,
                serviceStarting
            }}>
            {children}
        </WebSocketContext.Provider>
    );
};

export const useWebSocket = () => useContext(WebSocketContext);

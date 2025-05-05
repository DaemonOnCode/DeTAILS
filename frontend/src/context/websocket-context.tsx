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

interface IWebSocketContext {
    registerCallback(event: string, cb: CallbackFn): void;
    unregisterCallback(event: string): void;
    serviceStarting: boolean;
}

const WebSocketContext = createContext<IWebSocketContext>({
    registerCallback: () => {},
    unregisterCallback: () => {},
    serviceStarting: true
});

export const WebSocketProvider: FC<ILayout> = ({ children }) => {
    const { remoteProcessing, isAuthenticated } = useAuth();

    const [serviceStarting, setServiceStarting] = useState(true);
    const messageCallbacks = useRef<Record<string, CallbackFn>>({});
    const lastPingRef = useRef<Date | null>(null);
    const pingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const retryCountRef = useRef(0);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const MAX_RETRIES = 25;
    const BASE_DELAY = 2000;
    const clearReconnectTimeout = () => {
        if (reconnectTimeoutRef.current) {
            console.log('Clearing pending reconnect timeout');
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }
    };

    const resetRetryCount = () => {
        console.log('Resetting retry count');
        retryCountRef.current = 0;
        clearReconnectTimeout();
    };

    const resetPingTimeout = useCallback(() => {
        if (pingTimeoutRef.current) {
            clearTimeout(pingTimeoutRef.current);
        }
        console.log('Starting 60s ping watchdog');
        pingTimeoutRef.current = setTimeout(() => {
            const now = Date.now();
            if (lastPingRef.current && now - lastPingRef.current.getTime() > 60_000) {
                console.error('No ping received in 60s - backend service may be down');
                toast.error('No response from backend in the last 60 seconds.');
            }
        }, 60_000);
    }, []);

    const handleMessage = useCallback(
        (_: any, message: string) => {
            console.log('Received ws-message:', message);
            if (message === 'ping') {
                console.log('Handling ping');
                lastPingRef.current = new Date();
                resetPingTimeout();
                return;
            }
            Object.values(messageCallbacks.current).forEach((cb) => cb(message));
        },
        [resetPingTimeout]
    );

    const registerCallback = (event: string, cb: CallbackFn) => {
        console.log(`Registering callback for event "${event}"`);
        messageCallbacks.current[event] = cb;
    };

    const unregisterCallback = (event: string) => {
        console.log(`Unregistering callback for event "${event}"`);
        delete messageCallbacks.current[event];
    };

    const performConnect = useCallback(async () => {
        console.log(`Performing connect-ws (retry #${retryCountRef.current}, after backoff)`);
        try {
            await ipcRenderer.invoke('connect-ws', '');
            console.log(`ipcRenderer.invoke("connect-ws") returned—waiting for ws-connected event`);
        } catch (err: any) {
            console.warn('connect-ws invoke failed:', err);
            scheduleReconnect();
        }
    }, []);

    const scheduleReconnect = useCallback(() => {
        clearReconnectTimeout();
        retryCountRef.current += 1;
        const attempt = retryCountRef.current;
        if (attempt > MAX_RETRIES) {
            console.error(`Max retry count ${MAX_RETRIES} reached; giving up`);
            toast.error('WebSocket server is offline. Max retries reached.');
            return;
        }
        const delay = Math.min(BASE_DELAY * 2 ** (attempt - 1), 30_000);
        console.log(`Scheduling reconnect attempt #${attempt} in ${delay}ms`);
        reconnectTimeoutRef.current = setTimeout(() => {
            performConnect();
        }, delay);
    }, [performConnect]);

    const monitorWebSocketStatus = useCallback(
        (checkBackend: boolean) => {
            console.log(
                `Wiring up ws-connected and ws-closed handlers (checkBackend=${checkBackend})`
            );

            ipcRenderer.on('ws-connected', () => {
                console.log('Received ws-connected event');
                resetRetryCount();
                lastPingRef.current = new Date();
                resetPingTimeout();
                if (checkBackend) {
                    console.log('Backend check done; clearing serviceStarting');
                    setServiceStarting(false);
                }
            });

            ipcRenderer.on('ws-closed', () => {
                console.warn('Received ws-closed event');
                if (!isAuthenticated) {
                    console.log('Not authenticated; skipping reconnect');
                    return;
                }
                scheduleReconnect();
            });
        },
        [isAuthenticated, resetPingTimeout, scheduleReconnect]
    );

    const pollBackendServices = () => {
        console.log('Polling backend services…');
        setServiceStarting(true);

        retryCountRef.current = 0;
        performConnect();

        const handleServiceStarted = (_: any, serviceName: string) => {
            console.log('Service started event:', serviceName);
            if (serviceName === 'backend') {
                console.info('Backend service is up');
                toast.info('Backend service started');
            }
            performConnect();
        };
        const handleServiceStopped = (_: any, serviceName: string) => {
            console.log('Service stopped event:', serviceName);
            if (serviceName === 'backend') {
                console.error('Backend service has stopped');
                toast.error('Backend service stopped. Restart the application.');
            }
        };

        ipcRenderer.on('service-started', handleServiceStarted);
        ipcRenderer.on('service-stopped', handleServiceStopped);

        return () => {
            console.log('Cleaning up service-started/stopped listeners');
            ipcRenderer.removeListener('service-started', handleServiceStarted);
            ipcRenderer.removeListener('service-stopped', handleServiceStopped);
        };
    };

    useEffect(() => {
        if (!isAuthenticated) {
            console.log('User logged out; tearing down WebSocket…');
            clearReconnectTimeout();
            if (pingTimeoutRef.current) {
                clearTimeout(pingTimeoutRef.current);
                pingTimeoutRef.current = null;
            }
            ipcRenderer.removeAllListeners('ws-message');
            ipcRenderer.removeAllListeners('ws-connected');
            ipcRenderer.removeAllListeners('ws-closed');
            ipcRenderer.invoke('disconnect-ws').catch((err) => {
                console.error('Error disconnecting ws on logout:', err);
            });
            setServiceStarting(false);
        }
    }, [isAuthenticated]);

    useEffect(() => {
        console.log(`WebSocketProvider effect running; remoteProcessing=${remoteProcessing}`);
        ipcRenderer.removeAllListeners('ws-message');
        ipcRenderer.on('ws-message', handleMessage);

        monitorWebSocketStatus(!remoteProcessing);

        let cleanupServices = () => {};

        if (remoteProcessing) {
            console.log('Remote mode: skipping local backend poll');
            setServiceStarting(false);
            retryCountRef.current = 0;
            performConnect();
        } else {
            console.log('Local mode: polling backend services');
            cleanupServices = pollBackendServices();
        }

        return () => {
            console.log('WebSocketProvider cleanup');
            cleanupServices();
            clearReconnectTimeout();
            if (pingTimeoutRef.current) {
                clearTimeout(pingTimeoutRef.current);
                pingTimeoutRef.current = null;
            }
            ipcRenderer.removeAllListeners('ws-message');
            ipcRenderer.removeAllListeners('ws-connected');
            ipcRenderer.removeAllListeners('ws-closed');
            ipcRenderer.invoke('disconnect-ws').catch((err) => {
                console.error('Error disconnecting ws on cleanup:', err);
            });
            setServiceStarting(false);
        };
    }, [remoteProcessing, handleMessage, monitorWebSocketStatus, performConnect]);

    return (
        <WebSocketContext.Provider
            value={{ registerCallback, unregisterCallback, serviceStarting }}>
            {children}
        </WebSocketContext.Provider>
    );
};

export const useWebSocket = () => useContext(WebSocketContext);

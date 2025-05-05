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

    //— state & refs
    const [serviceStarting, setServiceStarting] = useState(true);
    const messageCbs = useRef<Record<string, CallbackFn>>({});
    const lastPing = useRef<Date | null>(null);
    const pingTimer = useRef<NodeJS.Timeout | null>(null);

    const retryCount = useRef(0);
    const reconnectTimer = useRef<NodeJS.Timeout | null>(null);

    const MAX_RETRIES = 25;
    const BASE_DELAY = 2000;

    /** Ensure we never leave a dangling timeout */
    const clearTimers = () => {
        if (pingTimer.current) {
            clearTimeout(pingTimer.current);
            pingTimer.current = null;
        }
        if (reconnectTimer.current) {
            clearTimeout(reconnectTimer.current);
            reconnectTimer.current = null;
        }
    };

    /** Reset retry state after a successful connection */
    const resetRetries = useCallback(() => {
        retryCount.current = 0;
        if (reconnectTimer.current) {
            clearTimeout(reconnectTimer.current);
            reconnectTimer.current = null;
        }
    }, []);

    /** Watchdog: if no ping in 60s, warn */
    const schedulePingWatchdog = useCallback(() => {
        if (pingTimer.current) clearTimeout(pingTimer.current);
        pingTimer.current = setTimeout(() => {
            const now = Date.now();
            if (lastPing.current && now - lastPing.current.getTime() > 60_000) {
                console.error('No ping in 60s');
                toast.error('No response from backend in the last 60 seconds.');
            }
        }, 60_000);
    }, []);

    /** Handle raw messages from the main process */
    const handleWsMessage = useCallback(
        (_: any, raw: string) => {
            // ping
            if (raw === 'ping') {
                lastPing.current = new Date();
                schedulePingWatchdog();
                return;
            }
            // dispatch to all registered callbacks
            Object.values(messageCbs.current).forEach((cb) => cb(raw));
        },
        [schedulePingWatchdog]
    );

    /** Send the `connect-ws` IPC, catch failure to trigger a retry schedule */
    const doConnect = useCallback(async () => {
        try {
            await ipcRenderer.invoke('connect-ws');
            // we’ll get a 'ws-connected' event next
        } catch (err) {
            console.warn('invoke(connect-ws) failed:', err);
            // schedule next retry
            scheduleReconnect();
        }
    }, []);

    /** Schedule an exponential‐backoff reconnect */
    const scheduleReconnect = useCallback(() => {
        retryCount.current += 1;
        if (retryCount.current > MAX_RETRIES) {
            toast.error('WebSocket server is offline. Max retries reached.');
            return;
        }
        const delay = Math.min(BASE_DELAY * 2 ** (retryCount.current - 1), 30_000);
        console.log(`Reconnecting in ${delay}ms (attempt #${retryCount.current})`);
        if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
        reconnectTimer.current = setTimeout(() => {
            doConnect();
        }, delay);
    }, [doConnect]);

    /** Hook up the `ws-connected` and `ws-closed` listeners */
    const setupStatusListeners = useCallback(
        (waitForBackend: boolean) => {
            const onOpen = () => {
                console.log('ws-connected');
                resetRetries();
                lastPing.current = new Date();
                schedulePingWatchdog();
                if (waitForBackend) {
                    setServiceStarting(false);
                }
            };

            const onClose = () => {
                console.warn('ws-closed');
                if (!isAuthenticated) return;
                scheduleReconnect();
            };

            ipcRenderer.on('ws-connected', onOpen);
            ipcRenderer.on('ws-closed', onClose);

            return () => {
                ipcRenderer.removeListener('ws-connected', onOpen);
                ipcRenderer.removeListener('ws-closed', onClose);
            };
        },
        [isAuthenticated, resetRetries, schedulePingWatchdog, scheduleReconnect]
    );

    /** If we're in local mode, watch for service start/stop */
    const pollLocalBackend = useCallback(() => {
        setServiceStarting(true);
        retryCount.current = 0;
        doConnect();

        const onStarted = (_: any, svc: string) => {
            console.log(`service-started: ${svc}`);
            if (svc === 'backend') {
                toast.info('Backend service started');
            }
            doConnect();
        };
        const onStopped = (_: any, svc: string) => {
            console.error(`service-stopped: ${svc}`);
            if (svc === 'backend') {
                toast.error('Backend service stopped. Restart the application.');
            }
        };

        ipcRenderer.on('service-started', onStarted);
        ipcRenderer.on('service-stopped', onStopped);

        return () => {
            ipcRenderer.removeListener('service-started', onStarted);
            ipcRenderer.removeListener('service-stopped', onStopped);
        };
    }, [doConnect]);

    /** Public API for consumers */
    const registerCallback = (event: string, cb: CallbackFn) => {
        messageCbs.current[event] = cb;
    };
    const unregisterCallback = (event: string) => {
        delete messageCbs.current[event];
    };

    /** 1) Tear down on logout */
    useEffect(() => {
        if (!isAuthenticated) {
            clearTimers();
            ipcRenderer.removeAllListeners('ws-message');
            ipcRenderer.removeAllListeners('ws-connected');
            ipcRenderer.removeAllListeners('ws-closed');
            ipcRenderer.invoke('disconnect-ws').catch(console.error);
            setServiceStarting(false);
        }
    }, [isAuthenticated]);

    /** 2) Main hookup: ws-message, status listeners, connect or poll */
    useEffect(() => {
        // always listen for messages
        ipcRenderer.removeAllListeners('ws-message');
        ipcRenderer.on('ws-message', handleWsMessage);

        // status
        const teardownStatus = setupStatusListeners(!remoteProcessing);

        // either remote (just connect once) or local (poll)
        let teardownBackend = () => {};
        if (remoteProcessing) {
            setServiceStarting(false);
            retryCount.current = 0;
            doConnect();
        } else {
            teardownBackend = pollLocalBackend();
        }

        // cleanup
        return () => {
            teardownStatus();
            teardownBackend();
            clearTimers();
            ipcRenderer.removeAllListeners('ws-message');
            ipcRenderer.invoke('disconnect-ws').catch(console.error);
            setServiceStarting(false);
        };
    }, [remoteProcessing, handleWsMessage, setupStatusListeners, pollLocalBackend, doConnect]);

    return (
        <WebSocketContext.Provider
            value={{ registerCallback, unregisterCallback, serviceStarting }}>
            {children}
        </WebSocketContext.Provider>
    );
};

export const useWebSocket = () => useContext(WebSocketContext);

import { createContext, useContext, useMemo, FC, useState } from 'react';
import { LOGGING, LOGGING_API_URL } from '../constants/Shared';
import { ILayout } from '../types/Coding/shared';

// Define the Logger type
type Logger = {
    info: (message: string, context?: Record<string, any>) => Promise<void>;
    warning: (message: string, context?: Record<string, any>) => Promise<void>;
    error: (message: string, context?: Record<string, any>) => Promise<void>;
    debug: (message: string, context?: Record<string, any>) => Promise<void>;
    health: (message: string, context?: Record<string, any>) => Promise<void>;
    time: (message: string, context?: Record<string, any>) => Promise<void>;
    setUserEmail: (user: string) => void;
};

// Create a default logger that does nothing (for cases when the context is not provided)
const defaultLogger: Logger = {
    info: async () => {},
    warning: async () => {},
    error: async () => {},
    debug: async () => {},
    health: async () => {},
    time: async () => {},
    setUserEmail: () => {}
};

// Create the LoggingContext
const LoggingContext = createContext<Logger>(defaultLogger);

// Define the LoggingProvider
export const LoggingProvider: FC<ILayout> = ({ children }) => {
    const [userEmail, setUserEmail] = useState<string>('');

    const logger = useMemo<Logger>(() => {
        const log = async (level: string, message: string, context: Record<string, any> = {}) => {
            try {
                console.log(`[${level.toUpperCase()}]: ${message}`);
                if (!LOGGING) return;
                await fetch(LOGGING_API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        sender: 'REACT',
                        email: userEmail || 'Anonymous',
                        level,
                        message,
                        context,
                        timestamp: new Date().toISOString()
                    })
                });
            } catch (error) {
                console.error('Failed to send log:', error);
            }
        };

        return {
            info: (message, context) => log('info', message, context),
            warning: (message, context) => log('warning', message, context),
            error: (message, context) => log('error', message, context),
            debug: (message, context) => log('debug', message, context),
            health: (message, context) => log('health', message, context),
            time: (message, context) => log('time', message, context),
            setUserEmail
        };
    }, [userEmail]);

    return <LoggingContext.Provider value={logger}>{children}</LoggingContext.Provider>;
};

// Hook to use logger
export const useLogger = (): Logger => {
    return useContext(LoggingContext);
};

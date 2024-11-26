import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { useAuth } from './auth_context';
import { LOGGING_API_URL } from '../constants/Shared';

// Define the Logger type
type Logger = {
    info: (message: string, context?: Record<string, any>) => Promise<void>;
    warning: (message: string, context?: Record<string, any>) => Promise<void>;
    error: (message: string, context?: Record<string, any>) => Promise<void>;
    debug: (message: string, context?: Record<string, any>) => Promise<void>;
};

// Create a default logger that does nothing (for cases when the context is not provided)
const defaultLogger: Logger = {
    info: async () => {},
    warning: async () => {},
    error: async () => {},
    debug: async () => {}
};

// Create the LoggingContext
const LoggingContext = createContext<Logger>(defaultLogger);

// Define props for LoggingProvider
interface LoggingProviderProps {
    children: ReactNode;
}

// Define the LoggingProvider
export const LoggingProvider: React.FC<LoggingProviderProps> = ({ children }) => {
    const { user } = useAuth();

    const logger = useMemo<Logger>(() => {
        const log = async (level: string, message: string, context: Record<string, any> = {}) => {
            try {
                await fetch(LOGGING_API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        email: user?.email ?? 'Anonymous',
                        level,
                        message,
                        context
                    })
                });
                console.log(`[${level.toUpperCase()}]: ${message}`);
            } catch (error) {
                console.error('Failed to send log:', error);
            }
        };

        return {
            info: (message, context) => log('info', message, context),
            warning: (message, context) => log('warning', message, context),
            error: (message, context) => log('error', message, context),
            debug: (message, context) => log('debug', message, context)
        };
    }, [user?.email]);

    return <LoggingContext.Provider value={logger}>{children}</LoggingContext.Provider>;
};

// Hook to use logger
export const useLogger = (): Logger => {
    return useContext(LoggingContext);
};

import { createContext, useContext, useMemo, FC, useState } from 'react';
import { LOGGING, LOGGING_API_URL } from '../constants/Shared';
import { ILayout } from '../types/Coding/shared';

type Logger = {
    info: (message: string, context?: Record<string, any>) => Promise<void>;
    warning: (message: string, context?: Record<string, any>) => Promise<void>;
    error: (message: string, context?: Record<string, any>) => Promise<void>;
    debug: (message: string, context?: Record<string, any>) => Promise<void>;
    health: (message: string, context?: Record<string, any>) => Promise<void>;
    time: (message: string, context?: Record<string, any>) => Promise<void>;
    setUserEmail: (user: string) => void;
    setType: (type: 'local' | 'remote') => void;
};

const defaultLogger: Logger = {
    info: async () => {},
    warning: async () => {},
    error: async () => {},
    debug: async () => {},
    health: async () => {},
    time: async () => {},
    setUserEmail: () => {},
    setType: () => {}
};

const LoggingContext = createContext<Logger>(defaultLogger);

export const LoggingProvider: FC<ILayout> = ({ children }) => {
    // Updated through auth context
    const [userEmail, setUserEmail] = useState<string>('');
    const [type, setType] = useState<'local' | 'remote'>('local');

    const logger = useMemo<Logger>(() => {
        const log = async (level: string, message: string, context: Record<string, any> = {}) => {
            try {
                console.log(`[${level.toUpperCase()}]: ${message}`);
                if (!LOGGING) return;
                await fetch(LOGGING_API_URL[type], {
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
            setUserEmail,
            setType
        };
    }, [userEmail, type]);

    return <LoggingContext.Provider value={logger}>{children}</LoggingContext.Provider>;
};

// Hook to use logger
export const useLogger = (): Logger => {
    return useContext(LoggingContext);
};

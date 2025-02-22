import { createContext, useContext, useState, useEffect, FC } from 'react';
import { AuthContextType, UserToken, User } from '../types/Shared';
import { ILayout } from '../types/Coding/shared';
import { useLogger } from './logging-context';

const { ipcRenderer } = window.require('electron');

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: FC<ILayout> = ({ children }) => {
    const logger = useLogger();

    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
        return JSON.parse(localStorage.getItem('isAuthenticated') || 'false');
    });
    const [user, setUser] = useState<User | null>(() => {
        return JSON.parse(localStorage.getItem('user') || 'null');
    });
    const [token, setToken] = useState<UserToken | null>(() => {
        return JSON.parse(localStorage.getItem('token') || 'null');
    });

    const [remoteProcessing, setRemoteProcessing] = useState<boolean>(
        JSON.parse(localStorage.getItem('remoteProcessing') || 'false')
    );

    useEffect(() => {
        if (isAuthenticated) {
            logger.setUserEmail(user?.email || '');
        }
    }, []);

    // Persist authentication state to localStorage
    useEffect(() => {
        localStorage.setItem('isAuthenticated', JSON.stringify(isAuthenticated));
        localStorage.setItem('user', JSON.stringify(user));
    }, [isAuthenticated, user]);

    const login = (user: User, token: UserToken) => {
        console.log('Logging in', user);
        setIsAuthenticated(true);
        setUser(user);
        setToken(token);
        logger.setUserEmail(user.email);
        logger.setType(remoteProcessing ? 'remote' : 'local');
    };

    const logout = async () => {
        setIsAuthenticated(false);
        setUser(null);
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem('user');
        logger.setUserEmail('');
        logger.setType('local');
        await ipcRenderer.invoke('logout');
    };

    const setProcessing = async (processing: boolean) => {
        setRemoteProcessing(processing);
        localStorage.setItem('remoteProcessing', JSON.stringify(processing));
        await logger.info(`Processing mode switched to: ${processing ? 'Remote' : 'Local'}`);
        await ipcRenderer.invoke('set-processing-mode', processing);
    };

    return (
        <AuthContext.Provider
            value={{ isAuthenticated, user, login, logout, remoteProcessing, setProcessing }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

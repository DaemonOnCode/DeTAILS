import { createContext, useContext, useState, useEffect, FC } from 'react';
import { Token, User } from '../types/Shared';
import { ILayout } from '../types/Coding/shared';
import { useLogger } from './logging_context';

interface AuthContextType {
    isAuthenticated: boolean;
    user: User | null;
    login: (user: User, token: Token) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: FC<ILayout> = ({ children }) => {
    const logger = useLogger();

    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
        return JSON.parse(sessionStorage.getItem('isAuthenticated') || 'false');
    });
    const [user, setUser] = useState<User | null>(() => {
        return JSON.parse(sessionStorage.getItem('user') || 'null');
    });
    const [token, setToken] = useState<Token | null>(() => {
        return JSON.parse(sessionStorage.getItem('token') || 'null');
    });

    useEffect(() => {
        if (isAuthenticated) {
            logger.setUserEmail(user?.email || '');
        }
    }, []);

    // Persist authentication state to sessionStorage
    useEffect(() => {
        sessionStorage.setItem('isAuthenticated', JSON.stringify(isAuthenticated));
        sessionStorage.setItem('user', JSON.stringify(user));
    }, [isAuthenticated, user]);

    const login = (user: User, token: Token) => {
        console.log('Logging in', user);
        setIsAuthenticated(true);
        setUser(user);
        setToken(token);
        logger.setUserEmail(user.email);
    };

    const logout = () => {
        setIsAuthenticated(false);
        setUser(null);
        sessionStorage.removeItem('isAuthenticated');
        sessionStorage.removeItem('user');
        logger.setUserEmail('');
    };

    return (
        <AuthContext.Provider value={{ isAuthenticated, user, login, logout }}>
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

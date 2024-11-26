import React, { createContext, useContext, useState, useEffect, FC, ReactNode } from 'react';

interface User {
    name: string;
    email: string;
    role: string;
}

interface AuthContextType {
    isAuthenticated: boolean;
    user: User | null;
    login: (user?: User) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: FC<{ children: ReactNode }> = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
        return JSON.parse(sessionStorage.getItem('isAuthenticated') || 'false');
    });
    const [user, setUser] = useState<User | null>(() => {
        return JSON.parse(sessionStorage.getItem('user') || 'null');
    });

    // Persist authentication state to sessionStorage
    useEffect(() => {
        sessionStorage.setItem('isAuthenticated', JSON.stringify(isAuthenticated));
        sessionStorage.setItem('user', JSON.stringify(user));
    }, [isAuthenticated, user]);

    const login = (userData?: User) => {
        console.log('Logging in', userData);
        if (!userData) {
            userData = {
                name: 'John Doe',
                email: 'john.doe@gmail.com',
                role: 'user'
            };
        }
        setIsAuthenticated(true);
        setUser(userData);
    };

    const logout = () => {
        setIsAuthenticated(false);
        setUser(null);
        sessionStorage.removeItem('isAuthenticated');
        sessionStorage.removeItem('user');
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

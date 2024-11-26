import React, { createContext, useContext, useState, useEffect, FC, ReactNode } from 'react';

interface User {
    id: string;
    email: string;
    verified_email: boolean;
    name: string;
    given_name: string;
    family_name: string;
    picture: string;
}

interface Token {
    access_token: string;
    refresh_token: string;
    scope: string;
    token_type: string;
    id_token: string;
    expiry_date: number;
}

interface AuthContextType {
    isAuthenticated: boolean;
    user: User | null;
    login: (user: User, token: Token) => void;
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
    const [token, setToken] = useState<Token | null>(() => {
        return JSON.parse(sessionStorage.getItem('token') || 'null');
    });

    useEffect(() => {
        console.log(JSON.parse(sessionStorage.getItem('user') || 'null'));
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

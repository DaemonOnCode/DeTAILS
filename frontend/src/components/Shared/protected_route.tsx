import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/auth_context';

export const ProtectedRoute: React.FC<{ roles?: string[] }> = ({ roles }) => {
    const { isAuthenticated, user } = useAuth();

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (roles && !roles.includes(user!.role)) {
        return <Navigate to="/unauthorized" replace />;
    }

    return <Outlet />;
};

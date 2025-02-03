import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/auth-context';
import { ROUTES as SHARED_ROUTES } from '../../constants/Shared';

export const ProtectedRoute: React.FC<{ roles?: string[] }> = ({ roles }) => {
    const { isAuthenticated } = useAuth();

    if (!isAuthenticated) {
        return <Navigate to={SHARED_ROUTES.LOGIN} replace />;
    }

    return <Outlet />;
};

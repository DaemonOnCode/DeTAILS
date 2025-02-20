import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { ROUTES as SHARED_ROUTES } from '../../constants/Shared';
import { useWorkspaceContext } from '../../context/workspace-context';
import { toast } from 'react-toastify';
import { useToast } from '../../context/toast-context';

export const WorkspaceProtectedRoute: React.FC<{ roles?: string[] }> = ({ roles }) => {
    const { currentWorkspace } = useWorkspaceContext();
    const { showToast } = useToast();

    if (!currentWorkspace) {
        showToast({
            type: 'error',
            message: 'Please select a workspace first'
        });
        // toast.error('Please select a workspace first');
        return <Navigate to={SHARED_ROUTES.WORKSPACE} replace />;
    }

    return <Outlet />;
};

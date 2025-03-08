import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/auth-context';
import { ROUTES } from '../../constants/Shared';

const { ipcRenderer } = window.require('electron');

const HomePage = () => {
    const { user, remoteProcessing } = useAuth();
    if (user && !remoteProcessing) {
        ipcRenderer.invoke('start-services');
    }
    if (user) return <Navigate to={ROUTES.WORKSPACE} />;
    else return <Navigate to={ROUTES.LOGIN} />;
};

export default HomePage;

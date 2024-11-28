import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/auth_context';
import { ROUTES } from '../../constants/Shared';

const HomePage = () => {
    const { user } = useAuth();
    if (user) return <Navigate to={ROUTES.DATA_COLLECTION} />;
    else return <Navigate to={ROUTES.LOGIN} />;
};

export default HomePage;

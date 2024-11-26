import React from 'react';
import { useAuth } from '../../context/auth_context';
import { useNavigate } from 'react-router-dom';

export const LoginPage: React.FC = () => {
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleLogin = () => {
        login();
        navigate('/dashboard'); // Redirect to a default route after login
    };

    return (
        <div className="flex justify-center items-center h-screen bg-gray-100">
            <button
                onClick={handleLogin}
                className="px-6 py-3 bg-blue-500 text-white rounded shadow hover:bg-blue-600">
                Login
            </button>
        </div>
    );
};

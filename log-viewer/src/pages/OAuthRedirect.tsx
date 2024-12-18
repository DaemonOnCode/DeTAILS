import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function OAuthRedirect() {
    const navigate = useNavigate();

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const token = params.get('token');

        if (token) {
            localStorage.setItem('auth_token', token);
            navigate('/log-viewer'); // Redirect to log viewer
        } else {
            console.error('No token found');
        }
    }, [navigate]);

    return (
        <div className="flex items-center justify-center h-screen bg-gray-100">
            <h1 className="text-xl font-bold">Redirecting... Please wait</h1>
        </div>
    );
}

export default OAuthRedirect;

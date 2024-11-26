import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants/Shared';
import { useAuth } from '../../context/auth_context';

const { ipcRenderer } = window.require('electron');

const LoginPage = () => {
    const navigate = useNavigate();

    const { login } = useAuth();

    const handleGoogleLogin = async () => {
        // Trigger Electron's main process for OAuth
        try {
            const { token, user } = await ipcRenderer.invoke('google-oauth-login');
            console.log('Google OAuth Token:', token);
            // Handle successful login logic here

            login(user, token);

            navigate('/' + ROUTES.DATA_SOURCES);
        } catch (error) {
            console.error('Google Sign-In Failed:', error);
        }
    };

    return (
        <div className="flex h-screen bg-gray-50 items-center justify-center">
            <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-lg">
                <h1 className="text-2xl font-bold text-gray-700 text-center">
                    Sign in to Your Account
                </h1>
                <p className="mt-2 text-sm text-gray-500 text-center">
                    Use your Google account to continue.
                </p>
                <div className="mt-6">
                    <button
                        onClick={handleGoogleLogin}
                        className="w-full flex items-center justify-center bg-white border border-gray-300 rounded-lg py-2 px-4 hover:bg-gray-100 transition duration-150">
                        <img
                            src="https://www.svgrepo.com/show/475656/google-color.svg"
                            alt="Google logo"
                            className="w-6 h-6 mr-2"
                        />
                        <span className="text-gray-700 font-medium">Sign in with Google</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;

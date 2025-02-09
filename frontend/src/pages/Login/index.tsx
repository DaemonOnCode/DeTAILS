import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants/Shared';
import { useAuth } from '../../context/auth-context';
import { useLogger } from '../../context/logging-context';
import LoginAnimation from '../../components/Login/login-animation';

const { ipcRenderer } = window.require('electron');

const LoginPage = () => {
    const navigate = useNavigate();

    const logger = useLogger();
    const { login, remoteProcessing, setProcessing } = useAuth();

    const handleGoogleLogin = async () => {
        console.log('Started onclick');
        // Trigger Electron's main process for OAuth
        try {
            await logger.info('Attempting Google OAuth Login');
            console.log('Attempting Google OAuth Login');
            const { token, user } = await ipcRenderer.invoke('google-oauth-login');
            console.log('Google OAuth Token:', token);
            await logger.info('Google OAuth Login Successful', { user });
            // Handle successful login logic here

            login(user, token);

            if (!remoteProcessing) {
                ipcRenderer.invoke('start-services');
            }

            navigate('/' + ROUTES.WORKSPACE);
        } catch (error) {
            await logger.error('Google OAuth Login Failed', { error });
            console.error('Google Sign-In Failed:', error);
        }
    };

    const toggleProcessingMode = async () => {
        await setProcessing(!remoteProcessing);

        // Notify Electron's main process about the change
        // await ipcRenderer.invoke('set-processing-mode', !remoteProcessing);

        await logger.info(`Processing mode switched to: ${remoteProcessing ? 'Remote' : 'Local'}`);
    };

    return (
        <LoginAnimation
            GoogleOauth={
                <div className="flex h-full w-screen items-start justify-center">
                    <div className="w-full max-w-sm sm:max-w-md px-8 py-4 sm:p-8 bg-white rounded-lg shadow-lg">
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
                                <span className="text-gray-700 font-medium">
                                    Sign in with Google
                                </span>
                            </button>
                        </div>
                        <div className="mt-4">
                            <button
                                onClick={toggleProcessingMode}
                                className={`w-full py-2 px-4 rounded-lg transition duration-150 font-semibold ${
                                    remoteProcessing
                                        ? 'bg-blue-500 text-white hover:bg-blue-600'
                                        : 'bg-green-500 text-white hover:bg-green-600'
                                }`}>
                                Switch to {remoteProcessing ? 'Local' : 'Remote'} Processing
                            </button>
                        </div>
                        <p className="mt-4 text-sm text-gray-500 text-center">
                            Current Processing Mode:{' '}
                            <strong>
                                {remoteProcessing ? 'Remote Processing' : 'Local processing'}
                            </strong>
                        </p>
                    </div>
                </div>
            }
        />
    );
};

export default LoginPage;

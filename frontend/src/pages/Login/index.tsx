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

    const toggleProcessingMode = async (processingBool: boolean) => {
        await setProcessing(processingBool);

        // Notify Electron's main process about the change
        // await ipcRenderer.invoke('set-processing-mode', !remoteProcessing);

        await logger.info(`Processing mode switched to: ${remoteProcessing ? 'Remote' : 'Local'}`);
    };

    return (
        <LoginAnimation
            GoogleOauth={
                <div className="flex h-full w-screen items-start justify-center">
                    <div className=" max-w-sm sm:max-w-md px-8 py- sm:p-3 bg-white rounded shadow-lg flex flex-col gap-y-4">
                        {/* <div>
                            <p className="mb-4 text-lg text-gray-500 text-center">
                                Processing Mode
                            </p>
                            <div className="mb-4 flex justify-center items-center gap-x-4 w-full">
                                <button
                                    onClick={() => toggleProcessingMode(false)}
                                    className={` max-w-48 py-2 px-4 rounded-lg transition duration-150 font-semibold ${
                                        !remoteProcessing
                                            ? 'bg-green-600 text-white hover:bg-green-700'
                                            : 'hover:bg-gray-200'
                                    }`}>
                                    Local
                                </button>
                                <button
                                    onClick={() => toggleProcessingMode(true)}
                                    className={` py-2 px-4 rounded-lg transition duration-150 font-semibold ${
                                        remoteProcessing
                                            ? 'bg-green-600 text-white hover:bg-green-700'
                                            : 'hover:bg-gray-200'
                                    }`}>
                                    Remote
                                </button>
                            </div>
                        </div> */}
                        <div
                            className="flex justify-center items-center gap-x-4 cursor-pointer"
                            onClick={handleGoogleLogin}>
                            <div className=" flex justify-center items-center">
                                <button
                                    // className="max-w-12 flex items-center justify-center bg-white border border-gray-300 rounded-lg py-2 px-4 hover:bg-gray-100 transition duration-150">
                                    className="max-w-12">
                                    <img
                                        src="https://www.svgrepo.com/show/475656/google-color.svg"
                                        alt="Google logo"
                                        className="w-8 h-8"
                                    />
                                </button>
                            </div>
                            <h1 className="text-2xl font-bold text-gray-700 text-center">
                                Log in with Google
                            </h1>
                        </div>
                    </div>
                </div>
            }
        />
    );
};

export default LoginPage;

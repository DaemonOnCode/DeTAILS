const ElectronGoogleOAuth2 = require('@getstation/electron-google-oauth2').default;
const { ipcMain } = require('electron');

let clientData;
if (process.env.NODE_ENV === 'development') {
    clientData = require(process.env.CLIENT_SECRET_FILE);
} else {
    clientData = require('../../client_secret_.json'); // Replace with your actual file name and path
}
const logger = require('../utils/logger');
const { findContextByName } = require('../utils/context');
const config = require('../../src/config')('electron');
const { electronLogger } = require('../utils/electron-logger');

const authHandler = (...ctxs) => {
    electronLogger.log(ctxs);
    const globalCtx = findContextByName('global', ctxs);

    ipcMain.handle('google-oauth-login', async () => {
        electronLogger.log(globalCtx.getState());

        electronLogger.log('Google OAuth Login');
        const googleOAuth = new ElectronGoogleOAuth2(
            clientData['installed']['client_id'],
            clientData['installed']['client_secret'],
            ['https://www.googleapis.com/auth/userinfo.profile'],
            {
                successRedirectURL: `${config.miscFrontendURL[globalCtx.getState().processing]}${config.googleOAuthRedirectPath}`
            }
        );

        try {
            electronLogger.log('Starting Google OAuth');
            await logger.info('Starting Google OAuth');
            const token = await googleOAuth.openAuthWindowAndGetTokens();

            const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: {
                    Authorization: `Bearer ${token.access_token}`
                }
            });
            electronLogger.log('Google OAuth Response:', response);

            electronLogger.log('Ctx State:', globalCtx.getState());

            const userInfo = await response.json();
            electronLogger.log('User Info:', userInfo);
            await logger.info('Google OAuth successful:', { userInfo });

            globalCtx.setState({ userEmail: userInfo.email });

            const oauthWindow = googleOAuth.authWindow;
            electronLogger.log('oauthWindow:', oauthWindow);
            if (oauthWindow && !oauthWindow.isDestroyed()) {
                oauthWindow.close();
            }
            electronLogger.log('Google OAuth Token:', token);
            return {
                token,
                user: userInfo
            };
        } catch (error) {
            await logger.error('Error during Google OAuth:', { error });
            electronLogger.error('Error during Google OAuth:', error);
            throw error;
        }
    });

    ipcMain.handle('logout', () => {
        globalCtx.setState({ userEmail: 'Anonymous' });
    });
};

module.exports = { authHandler };

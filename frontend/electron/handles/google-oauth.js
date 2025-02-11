const ElectronGoogleOAuth2 = require('@getstation/electron-google-oauth2').default;
const { ipcMain } = require('electron');

const clientData = require('../../client_secret_311037134589-q63krfrlg9d2edp7gsnlbouivttk3cr7.apps.googleusercontent.com.json');
// const config = require('../utils/config');
const logger = require('../utils/logger');
const { createMenu } = require('../utils/menu');
const { findContextByName } = require('../utils/context');
const config = require('../../src/config')('electron');
const { electronLogger } = require('../utils/electron-logger');

const googleOAuthHandler = (...ctxs) => {
    ipcMain.handle('google-oauth-login', async () => {
        electronLogger.log(ctxs);
        const globalCtx = findContextByName('global', ctxs);

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

            const userInfo = await response.json(); // Contains user information including email
            electronLogger.log('User Info:', userInfo);
            await logger.info('Google OAuth successful:', { userInfo });

            globalCtx.setState({ email: userInfo.email });

            const oauthWindow = googleOAuth.authWindow;
            electronLogger.log('oauthWindow:', oauthWindow);
            if (oauthWindow && !oauthWindow.isDestroyed()) {
                oauthWindow.close();
            }
            electronLogger.log('Google OAuth Token:', token);
            createMenu(...ctxs);
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
};

module.exports = { googleOAuthHandler };

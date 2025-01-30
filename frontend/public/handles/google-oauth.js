const ElectronGoogleOAuth2 = require('@getstation/electron-google-oauth2').default;
const { ipcMain } = require('electron');

const clientData = require('../../client_secret_311037134589-q63krfrlg9d2edp7gsnlbouivttk3cr7.apps.googleusercontent.com.json');
const config = require('../utils/config');
const logger = require('../utils/logger');
const { createMenu } = require('../utils/menu');

const googleOAuthHandler = () => {
    ipcMain.handle('google-oauth-login', async () => {
        console.log('Google OAuth Login');
        const googleOAuth = new ElectronGoogleOAuth2(
            clientData['installed']['client_id'],
            clientData['installed']['client_secret'],
            ['https://www.googleapis.com/auth/userinfo.profile'],
            {
                successRedirectURL: `${config.processing === 'http://local' ? 'localhost:4000' : config.backendServer}/misc-frontend/oauth-redirect`
            }
        );

        try {
            console.log('Starting Google OAuth');
            await logger.info('Starting Google OAuth');
            const token = await googleOAuth.openAuthWindowAndGetTokens();

            const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: {
                    Authorization: `Bearer ${token.access_token}`
                }
            });
            console.log('Google OAuth Response:', response);

            const userInfo = await response.json(); // Contains user information including email
            console.log('User Info:', userInfo);
            await logger.info('Google OAuth successful:', { userInfo });

            config.userEmail = userInfo.email;

            const oauthWindow = googleOAuth.authWindow;
            console.log('oauthWindow:', oauthWindow);
            if (oauthWindow && !oauthWindow.isDestroyed()) {
                oauthWindow.close();
            }
            console.log('Google OAuth Token:', token);
            createMenu();
            return {
                token,
                user: userInfo
            };
        } catch (error) {
            await logger.error('Error during Google OAuth:', { error });
            console.error('Error during Google OAuth:', error);
            throw error;
        }
    });
};

module.exports = { googleOAuthHandler };

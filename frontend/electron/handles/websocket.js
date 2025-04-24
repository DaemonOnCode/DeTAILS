const { ipcMain } = require('electron');
const WebSocket = require('ws');
const { findContextByName } = require('../utils/context');
const { electronLogger } = require('../utils/electron-logger');
const config = require('../../src/config')('electron');

let wsInstance = null;
let isConnecting = false;
let connectionPromise = null;
let debounceTimeout = null;

const sendToMainWindow = (globalCtx, channel, payload) => {
    try {
        const mainWindow = globalCtx.getState().mainWindow;
        if (!mainWindow) throw new Error('Main window not available');
        mainWindow.webContents.send(channel, payload);
        electronLogger.log(`Sent on channel "${channel}": ${JSON.stringify(payload)}`);
    } catch (e) {
        electronLogger.error(`Failed to send on channel "${channel}":`, e);
    }
};

const connectWS = (globalCtx) => {
    if (wsInstance && wsInstance.readyState === WebSocket.OPEN) {
        electronLogger.log('WebSocket already connected.');
        return Promise.resolve('WebSocket already connected.');
    }

    if (isConnecting) {
        electronLogger.log('Connection attempt already in progress.');
        return connectionPromise;
    }

    isConnecting = true;
    connectionPromise = new Promise((resolve, reject) => {
        try {
            const url = new URL(config.websocketURL[globalCtx.getState().processing]);
            const appId = globalCtx.getState().settings?.app?.id ?? 'default';
            const wsUrl = `ws://${url.host}${url.pathname}/notifications/ws?app=${appId}`;
            electronLogger.log(`Creating new WebSocket instance for ${wsUrl}`);

            wsInstance = new WebSocket(wsUrl);
            globalCtx.setState({ websocket: wsInstance });

            wsInstance.on('open', () => {
                isConnecting = false;
                electronLogger.log('WebSocket connected');
                sendToMainWindow(globalCtx, 'ws-connected', {});
                resolve('WebSocket connected');
            });

            wsInstance.on('close', (code, reason) => {
                electronLogger.log(`WebSocket closed: code=${code}, reason=${reason}`);
                isConnecting = false;
                connectionPromise = null;
                wsInstance = null;
                globalCtx.setState({ websocket: null });
                sendToMainWindow(globalCtx, 'ws-closed', { code, reason });
                reject(new Error(`WebSocket closed with code ${code}`));
            });

            wsInstance.on('error', (error) => {
                electronLogger.error(`WebSocket error: ${error.message}`);
                isConnecting = false;
                connectionPromise = null;
                wsInstance = null;
                globalCtx.setState({ websocket: null });
                sendToMainWindow(globalCtx, 'ws-error', error.message);
                reject(error);
            });

            wsInstance.on('message', (data) => {
                const message = data.toString('utf-8');
                electronLogger.log(`Received message: ${message}`);
                sendToMainWindow(globalCtx, 'ws-message', message);
            });
        } catch (e) {
            electronLogger.error(`WebSocket connection failed: ${e.message}`);
            isConnecting = false;
            connectionPromise = null;
            wsInstance = null;
            globalCtx.setState({ websocket: null });
            reject(e);
        }
    });

    return connectionPromise;
};

const connectWithRetry = async (
    globalCtx,
    maxRetries = 5,
    initialDelay = 1000,
    maxDelay = 30000
) => {
    let delay = initialDelay;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await connectWS(globalCtx);
            electronLogger.log(`Connected on attempt ${attempt}`);
            return 'Connected successfully';
        } catch (error) {
            electronLogger.error(`Attempt ${attempt} failed: ${error.message}`);
            if (attempt < maxRetries) {
                const nextDelay = Math.min(delay * 2, maxDelay);
                electronLogger.log(`Retrying in ${nextDelay}ms...`);
                await new Promise((resolve) => setTimeout(resolve, nextDelay));
                delay = nextDelay;
            } else {
                electronLogger.error('All retry attempts failed');
                throw new Error('Failed to connect after multiple attempts');
            }
        }
    }
};

const websocketHandler = (...ctxs) => {
    const globalCtx = findContextByName('global', ctxs);

    ipcMain.handle('connect-ws', () => {
        electronLogger.log('IPC connect-ws called');
        if (debounceTimeout) {
            electronLogger.log('Clearing existing debounce timeout');
            clearTimeout(debounceTimeout);
        }

        new Promise((resolve) => {
            debounceTimeout = setTimeout(async () => {
                electronLogger.log('Debounce timeout fired, calling connectWithRetry');
                try {
                    const result = await connectWithRetry(globalCtx);
                    electronLogger.log(`connectWithRetry resolved with: ${result}`);
                    resolve(result);
                } catch (error) {
                    electronLogger.error(`connectWithRetry failed: ${error.message}`);
                    resolve(`Failed to connect: ${error.message}`);
                }
            }, 500);
        });

        return;
    });

    ipcMain.handle('disconnect-ws', () => {
        electronLogger.log('IPC disconnect-ws called');
        try {
            if (wsInstance && wsInstance.readyState === WebSocket.OPEN) {
                electronLogger.log('Closing WebSocket connection');
                wsInstance.close();
            }
            if (debounceTimeout) {
                electronLogger.log('Clearing debounce timeout');
                clearTimeout(debounceTimeout);
                debounceTimeout = null;
            }
            wsInstance = null;
            globalCtx.setState({ websocket: null });
            isConnecting = false;
            connectionPromise = null;
            electronLogger.log('WebSocket disconnected successfully');
            return 'WebSocket disconnected';
        } catch (e) {
            electronLogger.error(`Error during disconnect: ${e.message}`);
            return 'Error during disconnect';
        }
    });
};

module.exports = { websocketHandler };

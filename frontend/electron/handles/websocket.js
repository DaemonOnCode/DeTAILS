const { ipcMain } = require('electron');
const WebSocket = require('ws');
const { findContextByName } = require('../utils/context');
const { electronLogger } = require('../utils/electron-logger');
const config = require('../../src/config')('electron');

let wsInstance = null;
let isConnecting = false;
let connectionPromise = null;
let debounceTimeout = null;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

const connectWS = (globalCtx, connectTimeout = 5000) => {
    if (wsInstance && wsInstance.readyState === WebSocket.OPEN) {
        electronLogger.log('WebSocket already connected.');
        sendToMainWindow(globalCtx, 'ws-connected');
        return Promise.resolve();
    }

    if (isConnecting) {
        electronLogger.log('Connection already in progress, reusing promise.');
        return connectionPromise;
    }

    isConnecting = true;
    connectionPromise = new Promise((resolve, reject) => {
        let timedOut = false;
        const urlObj = new URL(config.websocketURL[globalCtx.getState().processing]);
        const appId = globalCtx.getState().settings?.app?.id ?? 'default';
        const wsUrl = `ws://${urlObj.host}${urlObj.pathname}/notifications/ws?app=${appId}`;
        electronLogger.log(`Creating WebSocket to ${wsUrl}`);

        const ws = new WebSocket(wsUrl);
        wsInstance = ws;
        globalCtx.setState({ websocket: ws });

        const timeoutHandle = setTimeout(() => {
            timedOut = true;
            electronLogger.error('WebSocket connection timed out');
            ws.terminate();
            cleanup();
            reject(new Error('WebSocket connection timed out'));
        }, connectTimeout);

        function cleanup() {
            clearTimeout(timeoutHandle);
            isConnecting = false;
            connectionPromise = null;
            if (!ws || ws.readyState !== WebSocket.OPEN) {
                wsInstance = null;
                globalCtx.setState({ websocket: null });
            }
        }

        ws.on('open', () => {
            if (timedOut) return;
            electronLogger.log('WebSocket connected');
            cleanup();
            sendToMainWindow(globalCtx, 'ws-connected', {});
            resolve();
        });

        ws.on('message', (data) => {
            const message = data.toString('utf-8');
            electronLogger.log(`Received message: ${message}`);
            sendToMainWindow(globalCtx, 'ws-message', message);
        });

        ws.on('error', (err) => {
            if (timedOut) return;
            electronLogger.error(`WebSocket error: ${err.message}`);
            cleanup();
            sendToMainWindow(globalCtx, 'ws-error', err.message);
            reject(err);
        });

        ws.on('close', (code, reason) => {
            if (timedOut) return;
            electronLogger.log(`WebSocket closed: code=${code}, reason=${reason}`);
            cleanup();
            sendToMainWindow(globalCtx, 'ws-closed', { code, reason });
            reject(new Error(`WebSocket closed with code ${code}`));
        });
    });

    return connectionPromise;
};

async function connectWithRetry(
    globalCtx,
    { maxRetries = 5, initialDelay = 1000, maxDelay = 30000, connectTimeout = 5000 } = {}
) {
    let delay = initialDelay;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await connectWS(globalCtx, connectTimeout);
            electronLogger.log(`Connected on attempt ${attempt}`);
            return 'Connected successfully';
        } catch (err) {
            electronLogger.error(`Attempt ${attempt} failed: ${err.message}`);
            if (attempt === maxRetries) {
                electronLogger.error('All retry attempts failed');
                throw new Error('Failed to connect after multiple attempts');
            }
            electronLogger.log(`Retrying in ${delay}ms…`);
            await wait(delay);
            delay = Math.min(delay * 2, maxDelay);
        }
    }
}

const websocketHandler = (...ctxs) => {
    const globalCtx = findContextByName('global', ctxs);

    ipcMain.handle('connect-ws', () => {
        electronLogger.log('IPC connect-ws called');
        if (debounceTimeout) {
            electronLogger.log('Clearing existing debounce timeout');
            clearTimeout(debounceTimeout);
        }

        return new Promise((resolve) => {
            debounceTimeout = setTimeout(async () => {
                electronLogger.log('Debounce timeout fired, starting connectWithRetry');
                try {
                    const result = await connectWithRetry(globalCtx);
                    resolve(result);
                } catch (error) {
                    electronLogger.error(`connectWithRetry failed: ${error.message}`);
                    resolve(`Failed to connect: ${error.message}`);
                }
            }, 500);
        });
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

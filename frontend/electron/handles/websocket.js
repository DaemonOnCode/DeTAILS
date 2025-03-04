const { ipcMain } = require('electron');
const WebSocket = require('ws');
const { findContextByName } = require('../utils/context');
const { electronLogger } = require('../utils/electron-logger');
const config = require('../../src/config')('electron');

let wsInstance = null;
const maxReconnectAttempts = 5;
const baseDelay = 1000; // in milliseconds
let reconnectAttempts = 0;

const decodeMessage = (data) => {
    try {
        if (Buffer.isBuffer(data)) {
            return data.toString('utf-8');
        } else if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
            const uint8Array = new Uint8Array(data);
            return new TextDecoder('utf-8').decode(uint8Array);
        } else {
            console.warn('Unknown data type received:', data);
            return null;
        }
    } catch (error) {
        electronLogger.error('Error decoding message:', error);
        return null;
    }
};

// Encapsulated function to connect to the WebSocket server.
const connectWS = (globalCtx) => {
    try {
        electronLogger.log('Connecting to WebSocket...');
        const url = new URL(config.backendURL[globalCtx.getState().processing]);

        const settings = globalCtx.getState().settings;
        console.log('settings', settings);
        const appId = (settings && settings.app.id) ?? 'default';

        const wsUrl = `ws://${url.host}${url.pathname}/notifications/ws?app=${appId}`;
        electronLogger.log('URL:', url, wsUrl);
        wsInstance = new WebSocket(wsUrl);
        globalCtx.setState({ websocket: wsInstance });
        wsInstance.binaryType = 'arraybuffer';
    } catch (e) {
        electronLogger.log('Application closed');
        electronLogger.log(e);
        wsInstance = null;
        return;
    }

    wsInstance.on('open', () => {
        electronLogger.log('WebSocket connected');
        // Reset reconnection attempts after a successful connection.
        reconnectAttempts = 0;
        try {
            globalCtx.getState().mainWindow.webContents.send('ws-connected');
        } catch (e) {
            electronLogger.log('Application closed');
            electronLogger.log(e);
        }
    });

    wsInstance.on('close', (code, reason) => {
        let message = '';
        if (reason instanceof ArrayBuffer || ArrayBuffer.isView(reason)) {
            message = new TextDecoder('utf-8').decode(reason);
        } else {
            message = reason ? reason.toString() : 'No reason provided';
        }
        electronLogger.log('WebSocket closed:', code, message);
        try {
            wsInstance = null;
            globalCtx.setState({ websocket: null });
            globalCtx.getState().mainWindow.webContents.send('ws-closed', { code, message });
        } catch (e) {
            electronLogger.log('Application closed');
            electronLogger.log(e);
        }
    });

    wsInstance.on('error', (error) => {
        electronLogger.error('WebSocket error:', error.message);
        try {
            globalCtx.getState().mainWindow.webContents.send('ws-error', error.message);
        } catch (e) {
            electronLogger.log('Application closed');
            electronLogger.log(e);
        }
        // If an error occurs, try to reconnect with exponential backoff.
        if (reconnectAttempts < maxReconnectAttempts) {
            const delay = baseDelay * Math.pow(2, reconnectAttempts);
            electronLogger.log(
                `Attempting to reconnect in ${delay}ms... (Attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`
            );
            reconnectAttempts++;
            setTimeout(() => {
                connectWS(globalCtx);
            }, delay);
        } else {
            electronLogger.log(
                'Max reconnection attempts reached. No further reconnection will be attempted.'
            );
        }
    });

    wsInstance.on('message', (data) => {
        if (!wsInstance || wsInstance.readyState !== WebSocket.OPEN) {
            electronLogger.error('WebSocket not connected');
            if (wsInstance) {
                wsInstance.close();
            }
            wsInstance = null;
            globalCtx.setState({ websocket: null });
            try {
                globalCtx.getState().mainWindow.webContents.send('ws-closed', {
                    code: 1006,
                    message: 'WebSocket not connected'
                });
            } catch (e) {
                electronLogger.log('Application closed');
                electronLogger.log(e);
            }
            return;
        }

        const message = decodeMessage(data);
        if (message === null) {
            electronLogger.error('Failed to decode message.');
            return;
        }

        electronLogger.log('Decoded message from server:', message);

        // Handle ping-pong.
        if (message === 'ping') {
            wsInstance.send('pong');
        }

        try {
            globalCtx.getState().mainWindow.webContents.send('ws-message', message);
        } catch (e) {
            electronLogger.log('Application closed');
            electronLogger.log(e);
        }
    });
};

const websocketHandler = (...ctxs) => {
    const globalCtx = findContextByName('global', ctxs);

    ipcMain.handle('connect-ws', (event) => {
        if (wsInstance && wsInstance.readyState === WebSocket.OPEN) {
            electronLogger.log('WebSocket already connected.');
            return 'WebSocket already connected.';
        }

        if (globalCtx.getState().websocket) {
            return 'WebSocket already connected.';
        }

        // Reset reconnect attempts when a new connection is initiated.
        reconnectAttempts = 0;
        connectWS(globalCtx);
        return 'Connecting to WebSocket...';
    });

    ipcMain.handle('disconnect-ws', (event, message) => {
        electronLogger.log('Disconnecting WebSocket...');
        try {
            if (wsInstance && wsInstance.readyState === WebSocket.OPEN) {
                wsInstance.send('disconnect');
                wsInstance.close();
            }
        } catch (e) {
            electronLogger.log('Application closed, disconnect');
            electronLogger.log(e);
        } finally {
            wsInstance = null;
            globalCtx.setState({ websocket: null });
        }
    });
};

module.exports = { websocketHandler };

// let isHandlerRegistered = false;

const { ipcMain } = require('electron');
const WebSocket = require('ws');
const globalState = require('../utils/global-state');
const config = require('../../src/config')('electron');
const { findContextByName } = require('../utils/context');
const { electronLogger } = require('../utils/electron-logger');

let wsInstance = null;

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

        // Create a new WebSocket instance if not already connected
        try {
            electronLogger.log('Connecting to WebSocket...');
            const url = new URL(config.backendURL[globalCtx.getState().processing]);
            electronLogger.log(
                'URL:',
                url,
                `ws://${url.host}${url.pathname}/notifications/ws?app=electron`
            );
            wsInstance = new WebSocket(
                `ws://${url.host}${url.pathname}/notifications/ws?app=electron`
            );
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
                message = reason ? reason.toString() : 'No reason provided'; // Fallback for non-ArrayBuffer reasons
            }

            electronLogger.log('WebSocket closed:', code, message);
            // wsInstance.close();
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

            // electronLogger.log('Raw data received:', data);

            const message = decodeMessage(data);
            if (message === null) {
                electronLogger.error('Failed to decode message.');
                return;
            }

            electronLogger.log('Decoded message from server:', message);

            // Handle ping-pong
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
    });

    ipcMain.handle('disconnect-ws', (event, message) => {
        console.log('Disconnecting WebSocket...');
        // if (wsInstance && wsInstance.readyState === WebSocket.OPEN) {
        try {
            wsInstance.send('disconnect');
            wsInstance.close();
        } catch (e) {
            electronLogger.log('Application closed, disconnect');
            electronLogger.log(e);
        } finally {
            wsInstance = null;
            globalCtx.setState({ websocket: null });
        }
        // }
    });
};

module.exports = { websocketHandler };

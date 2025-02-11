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
            // Handle Buffer directly
            return data.toString('utf-8');
        } else if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
            // Handle ArrayBuffer or ArrayBufferView (e.g., Uint8Array) using TextDecoder
            const uint8Array = new Uint8Array(data);
            return new TextDecoder('utf-8').decode(uint8Array);
        } else {
            console.warn('Unknown data type received:', data);
            return null; // Or handle as needed
        }
    } catch (error) {
        console.error('Error decoding message:', error);
        return null; // Or throw error depending on use case
    }
};

const websocketHandler = (...ctxs) => {
    // if (isHandlerRegistered) return; // Prevent duplicate registration
    // isHandlerRegistered = true;
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
            electronLogger.log('Connecting to WebSocket...', globalCtx.getState());
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
            wsInstance = null; // Clear the instance on close
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
                wsInstance = null; // Clear the instance on close
                globalCtx.setState({ websocket: null });
                globalCtx.getState().mainWindow.webContents.send('ws-closed', { code, message });
            } catch (e) {
                electronLogger.log('Application closed');
                electronLogger.log(e);
            }
        });

        wsInstance.on('error', (error) => {
            console.error('WebSocket error:', error.message);
            try {
                globalCtx.getState().mainWindow.webContents.send('ws-error', error.message);
            } catch (e) {
                electronLogger.log('Application closed');
                electronLogger.log(e);
            }
        });

        wsInstance.on('message', (data) => {
            if (!wsInstance || wsInstance.readyState !== WebSocket.OPEN) {
                console.error('WebSocket not connected');
                if (wsInstance) {
                    wsInstance.close();
                }
                wsInstance = null; // Clear the instance on close
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

            electronLogger.log('Raw data received:', data);

            const message = decodeMessage(data);
            if (message === null) {
                console.error('Failed to decode message.');
                return;
            }

            electronLogger.log('Decoded message from server:', message);

            // Handle ping-pong
            if (message === 'ping') {
                wsInstance.send('pong');
                // return;
            }

            try {
                globalCtx.getState().mainWindow.webContents.send('ws-message', message);
            } catch (e) {
                electronLogger.log('Application closed');
                electronLogger.log(e);
            }
        });

        // return 'WebSocket connected.';
    });

    ipcMain.handle('disconnect-ws', (event, message) => {
        // if (wsInstance && wsInstance.readyState === WebSocket.OPEN) {
        try {
            wsInstance.send('disconnect');
            wsInstance.close();
        } catch (e) {
            electronLogger.log('Application closed');
            electronLogger.log(e);
        } finally {
            wsInstance = null;
            globalCtx.setState({ websocket: null });
        }
        // }
    });
};

module.exports = { websocketHandler };

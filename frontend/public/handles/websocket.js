// let isHandlerRegistered = false;

const { ipcMain } = require('electron');
const WebSocket = require('ws');
const config = require('../utils/config');

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

const websocketHandler = () => {
    // if (isHandlerRegistered) return; // Prevent duplicate registration
    // isHandlerRegistered = true;

    ipcMain.handle('connect-ws', (event, message) => {
        if (wsInstance && wsInstance.readyState === WebSocket.OPEN) {
            console.log('WebSocket already connected.');
            return 'WebSocket already connected.';
        }

        if (config.websocket) {
            return 'WebSocket already connected.';
        }

        // Create a new WebSocket instance if not already connected
        wsInstance = new WebSocket('ws://20.51.212.222/backend/api/notifications/ws?app=electron');
        config.websocket = wsInstance;
        wsInstance.binaryType = 'arraybuffer';

        wsInstance.on('open', () => {
            console.log('WebSocket connected');
            config.mainWindow.webContents.send('ws-connected');
        });

        wsInstance.on('close', (code, reason) => {
            let message = '';
            if (reason instanceof ArrayBuffer || ArrayBuffer.isView(reason)) {
                message = new TextDecoder('utf-8').decode(reason);
            } else {
                message = reason ? reason.toString() : 'No reason provided'; // Fallback for non-ArrayBuffer reasons
            }

            console.log('WebSocket closed:', code, message);
            // wsInstance.close();
            wsInstance = null; // Clear the instance on close
            config.websocket = null;
            try {
                config.mainWindow.webContents.send('ws-closed', { code, message });
            } catch (e) {
                console.log('Application closed');
                console.log(e);
            }
        });

        wsInstance.on('error', (error) => {
            console.error('WebSocket error:', error.message);
            config.mainWindow.webContents.send('ws-error', error.message);
        });

        wsInstance.on('message', (data) => {
            if (!wsInstance || wsInstance.readyState !== WebSocket.OPEN) {
                console.error('WebSocket not connected');
                wsInstance.close();
                wsInstance = null; // Clear the instance on close
                config.websocket = null;
                config.mainWindow.webContents.send('ws-closed', {
                    code: 1006,
                    message: 'WebSocket not connected'
                });
                return;
            }

            console.log('Raw data received:', data);

            const message = decodeMessage(data);
            if (message === null) {
                console.error('Failed to decode message.');
                return;
            }

            console.log('Decoded message from server:', message);

            // Handle ping-pong
            if (message === 'ping') {
                wsInstance.send('pong');
                // return;
            }

            config.mainWindow.webContents.send('ws-message', message);
        });
    });

    ipcMain.handle('disconnect-ws', (event, message) => {
        if (wsInstance && wsInstance.readyState === WebSocket.OPEN) {
            wsInstance.send('disconnect');
            wsInstance.close();
            wsInstance = null; // Clear the instance on close
            config.websocket = null;
        }
    });
};

module.exports = { websocketHandler };

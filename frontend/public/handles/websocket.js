const { ipcMain } = require('electron');
const WebSocket = require('ws');
const config = require('../utils/config');

const websocketHandler = () => {
    ipcMain.handle('connect-ws', (event, message) => {
        const ws = new WebSocket('ws://20.51.212.222/backend/api/notifications/ws');
        if (ws && ws.readyState === WebSocket.OPEN) {
            return 'WebSocket already connected.';
        }

        ws.binaryType = 'arraybuffer';
        ws.on('open', () => {
            console.log('WebSocket connected');

            // Notify renderer process
            const keepAliveInterval = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send('ping');
                    console.log('Ping sent to server');
                }
            }, 30000);

            config.mainWindow.webContents.send('ws-connected');

            ws.on('close', (code, reason) => {
                const message = new TextDecoder('utf-8').decode(reason);
                console.log('WebSocket closed:', code, message);
                config.mainWindow.webContents.send('ws-closed', { code, message });
                clearInterval(keepAliveInterval);
                config.websocket = null;
            });

            ws.on('error', (error) => {
                const message = new TextDecoder('utf-8').decode(error);
                console.error('WebSocket error:', error, message);
                config.mainWindow.webContents.send('ws-error', message);
                // clearInterval(keepAliveInterval);
                // config.websocket = null;
            });
        });

        ws.on('message', (data) => {
            // Forward message to renderer process
            const arrayBuffer = data;
            const message = new TextDecoder('utf-8').decode(arrayBuffer);
            console.log('Message from server:', message);
            config.mainWindow.webContents.send('ws-message', message);
        });
        config.websocket = ws;
    });

    ipcMain.handle('disconnect-ws', (event, message) => {
        if (config.websocket) {
            config.websocket.close();
        }
    });
};

module.exports = { websocketHandler };

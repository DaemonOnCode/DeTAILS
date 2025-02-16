const path = require('path');
const express = require('express');
const { electronLogger } = require('./electron-logger');

function createExpressServer() {
    const server = express();
    const buildPath = path.join(__dirname, '..', '..', 'build');
    electronLogger.log(`Serving static files from: ${buildPath}`);

    // Serve specific root-level assets explicitly.
    server.get(['/favicon.ico', '/manifest.json', '/logo192.png'], (req, res) => {
        const fileName = req.path.replace(/^\//, '');
        const filePath = path.join(buildPath, fileName);
        electronLogger.log(`Serving ${req.path} from ${filePath}`);
        res.sendFile(filePath, (err) => {
            if (err) {
                electronLogger.error(`Error sending ${req.path}: ${err}`);
                res.status(err.status || 500).end();
            }
        });
    });

    server.use((req, res, next) => {
        if (req.url.startsWith('/browser-frontend')) {
            const originalUrl = req.url;
            req.url = req.url.replace(/^\/browser-frontend/, '') || '/';
            electronLogger.log(`Rewritten URL from ${originalUrl} to ${req.url}`);
        }
        next();
    });

    server.use(express.static(buildPath));

    server.get('*', (req, res) => {
        electronLogger.log(`Fallback: Sending index.html for ${req.originalUrl}`);
        res.sendFile(path.join(buildPath, 'index.html'), (err) => {
            if (err) {
                electronLogger.error(`Error sending index.html for ${req.originalUrl}: ${err}`);
                res.status(err.status || 500).end();
            }
        });
    });

    server.all('*', (req, res) => {
        electronLogger.error(`Path not allowed: ${req.originalUrl} - returning 444`);
        res.status(444).end();
    });

    const port = 3000;
    const listener = server.listen(port, () => {
        electronLogger.log(`Express server running at http://localhost:${port}`);
    });

    listener.on('error', (error) => {
        electronLogger.error(`Error starting Express server on port ${port}: ${error}`);
    });
}

module.exports = { createExpressServer };

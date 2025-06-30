const { ipcMain, BrowserView } = require('electron');
const path = require('path');
const fs = require('fs');
const { findContextByName } = require('../utils/context');
const config = require('../../src/config')('electron');
const { electronLogger } = require('../utils/electron-logger');

let mammoth;
try {
    mammoth = require('mammoth');
} catch (err) {
    electronLogger.warn('Mammoth library not found. DOCX conversion will not be available.');
}

const webviewHandler = (...ctxs) => {
    console.log('registered webviewHandler');
    const globalCtx = findContextByName('global', ctxs);

    ipcMain.handle('render-file-webview', async (event, options) => {
        const { url, filePath, content, contentType, bounds } = options || {};
        electronLogger.log('Rendering requested with options:', options);

        const currentView = globalCtx.getState().browserView;
        if (currentView) {
            globalCtx.getState().mainWindow.removeBrowserView(currentView);
            globalCtx.setState({ browserView: null });
            if (currentView.webContents && !currentView.webContents.isDestroyed()) {
                currentView.webContents.destroy();
            }
        }

        const view = new BrowserView({
            webPreferences: {
                contextIsolation: false,
                nodeIntegration: true,
                webSecurity: false
            }
        });

        const mainWindow = globalCtx.getState().mainWindow;
        mainWindow.setBrowserView(view);

        let viewBounds;
        if (
            bounds &&
            typeof bounds === 'object' &&
            'x' in bounds &&
            'y' in bounds &&
            'width' in bounds &&
            'height' in bounds
        ) {
            viewBounds = bounds;
        } else {
            const viewWidth = 600;
            const viewHeight = 400;
            const [mainWidth, mainHeight] = mainWindow.getContentSize();
            const x = Math.round((mainWidth - viewWidth) / 2);
            const y = Math.round((mainHeight - viewHeight) / 2);
            viewBounds = { x, y, width: viewWidth, height: viewHeight };
        }
        view.setBounds(viewBounds);
        view.setAutoResize({ width: true, height: true, x: true, y: true });

        try {
            if (url) {
                await view.webContents.loadURL(url);
            } else if (filePath) {
                const fileType = path.extname(filePath).toLowerCase();
                if (fileType === '.pdf') {
                    const fileUrl =
                        filePath.startsWith('http://') || filePath.startsWith('https://')
                            ? filePath
                            : `file://${filePath}`;
                    await view.webContents.loadURL(fileUrl);
                } else if (fileType === '.txt') {
                    const templatePath = path.join(
                        __dirname,
                        '..',
                        'templates',
                        'text-template.html'
                    );
                    await view.webContents.loadFile(templatePath);
                    const fileContent = fs.readFileSync(filePath, 'utf8');
                    await view.webContents.executeJavaScript(`
                        (function() {
                            const container = document.getElementById('content');
                            if (container) {
                                container.innerText = ${JSON.stringify(fileContent)};
                            }
                        })();
                    `);
                } else if (fileType === '.docx') {
                    if (mammoth) {
                        const conversionResult = await mammoth.convertToHtml({ path: filePath });
                        const htmlContent = conversionResult.value;
                        const templatePath = path.join(
                            __dirname,
                            '..',
                            'templates',
                            'docx-template.html'
                        );
                        await view.webContents.loadFile(templatePath);
                        await view.webContents.executeJavaScript(`
                            (function() {
                                const container = document.getElementById('content');
                                if (container) {
                                    container.innerHTML = ${JSON.stringify(htmlContent)};
                                }
                            })();
                        `);
                    } else {
                        throw new Error('DOCX conversion not available');
                    }
                } else {
                    throw new Error('Unsupported file type');
                }
            } else if (content && contentType) {
                if (contentType === 'text') {
                    const templatePath = path.join(
                        __dirname,
                        '..',
                        'templates',
                        'text-template.html'
                    );
                    await view.webContents.loadFile(templatePath);
                    await view.webContents.executeJavaScript(`
                        (function() {
                            const container = document.getElementById('content');
                            if (container) {
                                container.innerText = ${JSON.stringify(content)};
                            }
                        })();
                    `);
                } else if (contentType === 'html') {
                    const templatePath = path.join(
                        __dirname,
                        '..',
                        'templates',
                        'html-template.html'
                    );
                    await view.webContents.loadFile(templatePath);
                    await view.webContents.executeJavaScript(`
                        (function() {
                            const container = document.getElementById('content');
                            if (container) {
                                container.innerHTML = ${JSON.stringify(content)};
                            }
                        })();
                    `);
                } else {
                    throw new Error('Unsupported content type');
                }
            } else {
                throw new Error('No url, filePath, or content provided');
            }

            if (!url && (!filePath || path.extname(filePath).toLowerCase() !== '.pdf')) {
                await view.webContents.insertCSS(`
                    body {
                        background-color: #f5f5f5 !important;
                        color: #333 !important;
                        font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
                        padding: 20px;
                        margin: 0;
                        box-sizing: border-box;
                    }
                    #content {
                        max-width: 100%;
                        margin: 0 auto;
                        line-height: 1.6;
                        overflow-wrap: break-word;
                    }
                    img, table, iframe {
                        max-width: 100% !important;
                        height: auto !important;
                    }
                `);
                electronLogger.log('Custom CSS injected successfully.');
            }
        } catch (error) {
            electronLogger.error('Error loading content:', error);
            throw error;
        }

        globalCtx.setState({ browserView: view });

        return {
            success: true,
            bounds: view.getBounds()
        };
    });

    ipcMain.handle('close-file-webview', async (event) => {
        const currentView = globalCtx.getState().browserView;
        if (currentView) {
            globalCtx.getState().mainWindow.removeBrowserView(currentView);
            globalCtx.setState({ browserView: null });
            if (currentView.webContents && !currentView.webContents.isDestroyed()) {
                currentView.webContents.destroy();
            }
            return { success: true };
        }
        return { success: false };
    });

    ipcMain.handle('set-file-webview-bounds', (event, bounds) => {
        const currentView = globalCtx.getState().browserView;
        if (currentView) {
            currentView.setBounds(bounds);
        }
    });

    ipcMain.handle('render-interview-webview', async (event, fileId, bounds) => {
        electronLogger.log('Rendering interview transcript:', fileId);

        const oldView = globalCtx.getState().browserView;
        if (oldView) {
            globalCtx.getState().mainWindow.removeBrowserView(oldView);
            if (!oldView.webContents.isDestroyed()) oldView.webContents.destroy();
            globalCtx.setState({ browserView: null });
        }

        const view = new BrowserView({
            webPreferences: {
                contextIsolation: false,
                nodeIntegration: false,
                webSecurity: false
            }
        });
        const win = globalCtx.getState().mainWindow;
        win.setBrowserView(view);
        globalCtx.setState({ browserView: view });

        let viewBounds = bounds;
        if (!viewBounds) {
            const [mw, mh] = win.getContentSize();
            viewBounds = {
                x: Math.round((mw - 700) / 2),
                y: Math.round((mh - 500) / 2),
                width: 700,
                height: 500
            };
        }
        view.setBounds(viewBounds);
        view.setAutoResize({ width: true, height: true, x: true, y: true });

        let turns;
        electronLogger.log('Fetching interview data from backend...', fileId);
        try {
            const res = await fetch(
                `${config.backendURL[globalCtx.getState().processing]}/${config.backendRoutes.GET_INTERVIEW_DATA_BY_ID}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-App-Id': globalCtx.getState().settings.app.id
                    },
                    body: JSON.stringify({ interview_file_id: fileId })
                }
            );
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            turns = await res.json();
        } catch (err) {
            electronLogger.error('Failed to load interview data:', err);
            throw err;
        }

        const templatePath = path.join(
            __dirname,
            '..',
            'templates',
            'interview-transcript-template.html'
        );
        await view.webContents.loadFile(templatePath);

        view.webContents.on('did-stop-loading', () => {
            const json = JSON.stringify(turns);
            view.webContents
                .executeJavaScript(
                    `
      (function() {
        const turns = ${json};
        const container = document.getElementById('content');
        if (!container) return;
        container.innerHTML = turns
          .map(t => \`
            <div class="turn">
              <div class="meta">
                <span class="speaker">\${t.speaker}</span>
                <span class="timestamp">\${t.timestamp}</span>
              </div>
              <div class="text">\${t.text.replace(/\\n/g,'<br/>')}</div>
            </div>
          \`).join('');
      })();
    `
                )
                .catch((err) => electronLogger.error('Injection error:', err));
        });

        return { success: true, bounds: view.getBounds() };
    });

    ipcMain.handle('close-interview-webview', async (event) => {
        const view = globalCtx.getState().browserView;
        if (view) {
            globalCtx.getState().mainWindow.removeBrowserView(view);
            if (!view.webContents.isDestroyed()) view.webContents.destroy();
            globalCtx.setState({ browserView: null });
            return { success: true };
        }
        return { success: false };
    });

    ipcMain.handle('set-interview-webview-bounds', (event, bounds) => {
        const view = globalCtx.getState().browserView;
        if (view) {
            view.setBounds(bounds);
            view.setAutoResize({ width: true, height: true, x: true, y: true });
        }
    });
};

module.exports = { webviewHandler };

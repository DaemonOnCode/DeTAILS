const { ipcMain, BrowserView } = require('electron');
const path = require('path');
const fs = require('fs');
const { findContextByName } = require('../utils/context');
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

    ipcMain.handle('render-file-webview', async (event, filePath, options = {}) => {
        electronLogger.log('File rendering requested for:', filePath);

        // Determine file type from options or file extension.
        const fileType = options.fileType || path.extname(filePath).toLowerCase();

        // Remove any existing BrowserView.
        const currentView = globalCtx.getState().browserView;
        if (currentView) {
            globalCtx.getState().mainWindow.removeBrowserView(currentView);
            globalCtx.setState({ browserView: null });
        }

        // Create a new BrowserView with nodeIntegration enabled for our injected scripts.
        const view = new BrowserView({
            webPreferences: {
                contextIsolation: false,
                nodeIntegration: true,
                webSecurity: false
            }
        });

        const mainWindow = globalCtx.getState().mainWindow;
        mainWindow.setBrowserView(view);

        // Define the view dimensions and center the view.
        const viewWidth = 600;
        const viewHeight = 400;
        const [mainWidth, mainHeight] = mainWindow.getContentSize();
        const x = Math.round((mainWidth - viewWidth) / 2);
        const y = Math.round((mainHeight - viewHeight) / 2);
        view.setBounds({ x, y, width: viewWidth, height: viewHeight });
        view.setAutoResize({ width: true, height: true, x: true, y: true });

        try {
            if (fileType === '.pdf') {
                // For PDFs, load directly.
                const fileUrl =
                    filePath.startsWith('http://') || filePath.startsWith('https://')
                        ? filePath
                        : `file://${filePath}`;
                await view.webContents.loadURL(fileUrl);
            } else if (fileType === '.txt') {
                // For TXT files, load a custom HTML template and inject the file content.
                const templatePath = path.join(__dirname, '..', 'templates', 'text-template.html');
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
                // For DOCX files, try converting to HTML using mammoth if available.
                if (mammoth) {
                    try {
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
                    } catch (conversionError) {
                        electronLogger.error('Error converting DOCX to HTML:', conversionError);
                        // Fallback to Google Docs viewer if conversion fails.
                        const fileUrl =
                            filePath.startsWith('http://') || filePath.startsWith('https://')
                                ? filePath
                                : `file://${filePath}`;
                        const googleViewerUrl = `https://docs.google.com/gview?embedded=true&url=\${encodeURIComponent(fileUrl)}`;
                        await view.webContents.loadURL(googleViewerUrl);
                    }
                } else {
                    // Fallback: use Google Docs viewer if mammoth is not available.
                    const fileUrl =
                        filePath.startsWith('http://') || filePath.startsWith('https://')
                            ? filePath
                            : `file://${filePath}`;
                    const googleViewerUrl = `https://docs.google.com/gview?embedded=true&url=\${encodeURIComponent(fileUrl)}`;
                    await view.webContents.loadURL(googleViewerUrl);
                }
            } else {
                throw new Error('Unsupported file type');
            }
        } catch (error) {
            electronLogger.error('Error loading file:', error);
            throw error;
        }

        // Inject custom CSS into the loaded template for TXT and DOCX.
        if (fileType === '.txt' || fileType === '.docx') {
            try {
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
            } catch (cssError) {
                electronLogger.error('Error injecting custom CSS:', cssError);
            }
        }

        // Update the global state with the new BrowserView.
        globalCtx.setState({ browserView: view });

        return {
            success: true,
            bounds: view.getBounds()
        };
    });

    ipcMain.handle('close-file-webview', async (event) => {
        const currentView = globalCtx.getState().browserView;
        if (currentView) {
            const mainWindow = globalCtx.getState().mainWindow;
            mainWindow.removeBrowserView(currentView);
            globalCtx.setState({ browserView: null });
            if (currentView.webContents && !currentView.webContents.isDestroyed()) {
                currentView.webContents.destroy();
            }
            return { success: true };
        }
        return { success: false };
    });
};

module.exports = { webviewHandler };

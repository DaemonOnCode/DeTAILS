const { ipcMain, BrowserView } = require('electron');
const puppeteer = require('puppeteer-core');
const logger = require('../utils/logger');
const path = require('path');
const { findContextByName } = require('../utils/context');
const config = require('../../src/config')('electron');
const { electronLogger } = require('../utils/electron-logger');

const redditHandler = (...ctxs) => {
    const globalCtx = findContextByName('global', ctxs);
    ipcMain.handle('fetch-reddit-content', async (event, url) => {
        try {
            await logger.info('Fetching Reddit content:', url);
            const content = await fetchRedditContent(url);
            return content;
        } catch (error) {
            await logger.error('Error fetching Reddit content:', error);
            electronLogger.error('Error fetching Reddit content:', error);
            return { error: 'Failed to fetch content' };
        }
    });

    ipcMain.handle(
        'render-reddit-webview',
        async (event, url, text, postId = '', workspaceId = '', getFromPostData = true) => {
            electronLogger.log('url', url, globalCtx.getState());
            if (url?.startsWith('/r/')) {
                url = 'https://www.reddit.com' + url;
            }

            // Remove existing BrowserView if it exists
            if (globalCtx.getState().browserView) {
                globalCtx.getState().mainWindow.removeBrowserView(globalCtx.getState().browserView);
                globalCtx.setState({ browserView: null });
            }

            const view = new BrowserView({
                webPreferences: {
                    contextIsolation: false,
                    nodeIntegration: false,
                    webSecurity: false
                }
            });

            globalCtx.getState().mainWindow.setBrowserView(view);

            globalCtx.setState({ browserView: view });

            const viewWidth = 600;
            const viewHeight = 400;

            const [mainWidth, mainHeight] = globalCtx.getState().mainWindow.getContentSize();

            const x = Math.round((mainWidth - viewWidth) / 2);
            const y = Math.round((mainHeight - viewHeight) / 2);

            view.setBounds({ x, y, width: viewWidth, height: viewHeight });
            view.setAutoResize({ width: true, height: true, x: true, y: true });

            // Listen for redirects and navigation events
            view.webContents.session.webRequest.onBeforeRedirect((details) => {
                electronLogger.log('Redirect detected via webRequest:', details.redirectURL);
                url = details.redirectURL; // Update the URL with the redirect destination
            });

            let postData = null;
            if (getFromPostData) {
                if (!postId) {
                    electronLogger.log('URL', url);
                    return {
                        success: false,
                        message: 'Post ID not provided'
                    };
                }

                electronLogger.log('postId', postId);

                const url = `${config.backendURL[globalCtx.getState().processing]}/${config.backendRoutes.GET_REDDIT_POST_BY_ID}`;

                console.log('url', url, postId, workspaceId);

                const res = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-App-Id': globalCtx.getState().settings.app.id
                    },
                    body: JSON.stringify({ postId, workspaceId })
                });
                postData = await res.json();
            }

            electronLogger.log('postData', postData);

            // Load the URL
            if (!getFromPostData) {
                await logger.info(`Loading Reddit content:, ${url}`);
                view.webContents.loadURL(url);
            } else {
                const templatePath = path.join(
                    __dirname,
                    '..',
                    'templates',
                    'reddit-template.html'
                );
                electronLogger.log('Loading template from:', templatePath);
                try {
                    if (!globalCtx.getState().browserView) return;
                    await view.webContents.loadFile(templatePath);
                } catch (error) {
                    electronLogger.error('Error loading template:', error);
                }
            }

            electronLogger.log('text', text);

            view.webContents.on('did-stop-loading', () => {
                electronLogger.log('Did finish load event');
                if (getFromPostData) {
                    electronLogger.log('Injecting post data:', postData);
                    function renderComments(comments) {
                        if (!comments || comments.length === 0) {
                            return '';
                        }

                        return `
                            <div class="comments">
                            ${comments
                                .map(
                                    (comment) => `
                                    <div class="comment">
                                    <h3 class="comment-author">${comment.author}</h3>
                                    <p class="comment-body">${comment.body}</p>
                                    ${renderComments(comment.comments || [])}
                                    </div>
                                    `
                                )
                                .join('')}
                                    </div>
                                    `;
                    }
                    view.webContents
                        .executeJavaScript(
                            `(function() {
                                const container = document.getElementById('content');

                                const postHtml = \`
                                <div class="post">
                                <h1 class="post-title">${postData.title}</h1>
                                <p class="post-body">${postData.selftext}</p>
                                </div>
                                ${renderComments(postData.comments)}
                                \`;
                                
                                container.innerHTML = postHtml;
                            })();`
                        )
                        .catch((error) => {
                            electronLogger.error('Error injecting post data:', error);
                        });
                }
                if (text) {
                    electronLogger.log('Injecting sentence:', text);
                    view.webContents
                        .executeJavaScript(
                            `
                            (function() {
                                try {
                                const sentence = ${JSON.stringify(text)};
                                const highlightColor = '#FFF9C4'; 
                                const textColor = '#000000'; 
                                const highlightClass = 'highlighted-sentence';
                        
                                const style = document.createElement('style');
                                style.innerHTML = \`
                                    .\${highlightClass} {
                                    background-color: \${highlightColor};
                                    color: \${textColor};
                                    transition: background-color 0.5s ease;
                                    padding: 2px;
                                    border-radius: 4px;
                                    }
                                \`;
                                document.head.appendChild(style);
                        
                                function highlightExactText(node, sentence) {
                                    if (node.nodeType === Node.TEXT_NODE) {
                                        const index = node.textContent.indexOf(sentence);
                                        if (index !== -1) {
                                            const range = document.createRange();
                                            range.setStart(node, index);
                                            range.setEnd(node, index + sentence.length);
                            
                                            const span = document.createElement('span');
                                            span.className = highlightClass;
                                            span.textContent = sentence;
                            
                                            range.deleteContents();
                                            range.insertNode(span);

                                            return true;
                                        }
                                    }
                                    return false;
                                }
                        
                                function searchAndHighlight(node, sentence) {
                                    for (let child of node.childNodes) {
                                        if (highlightExactText(child, sentence)) {
                                            return; 
                                        }
                                        searchAndHighlight(child, sentence); 
                                    }
                                }
                        
                                searchAndHighlight(document.body, sentence);
                        
                                } catch (error) {
                                    console.error('Error in injected script:', error);
                                }
                            })();
                        `
                        )
                        .catch(async (error) => {
                            await logger.error('Error executing injected script:', error);
                            electronLogger.error('Error executing injected script:', error);
                        });
                }
            });
            return {
                success: true,
                bounds: view.getBounds()
            };
        }
    );

    ipcMain.handle('close-reddit-webview', async (event) => {
        const currentView = globalCtx.getState().browserView;
        if (currentView) {
            await logger.info('Closing Reddit BrowserView');
            currentView.setBounds({ x: 0, y: 0, width: 1, height: 1 });
            globalCtx.getState().mainWindow.removeBrowserView(currentView);
            globalCtx.getState().mainWindow.setBrowserView(null);

            if (currentView.webContents && !currentView.webContents.isDestroyed()) {
                currentView.webContents.destroy();
            }

            globalCtx.setState({ browserView: null });
        }
    });

    ipcMain.handle('set-reddit-webview-bounds', (event, bounds) => {
        const currentView = globalCtx.getState().browserView;
        if (currentView) {
            currentView.setBounds(bounds);
        }
    });

    const linkCreator = (id, type, postId, subreddit) => {
        if (type === 'post') {
            return `https://www.reddit.com/r/${subreddit}/comments/${postId}/`;
        } else if (type === 'comment') {
            return `https://www.reddit.com/r/${subreddit}/comments/${postId}/${id}/`;
        }
    };

    ipcMain.handle(
        'get-link-from-post',
        async (event, postId, commentSlice, workspaceId, dbPath) => {
            electronLogger.log(
                'get-link-from-post',
                postId,
                commentSlice,
                workspaceId,
                globalCtx.getState()
            );

            if (config.backendURL[globalCtx.getState().processing]) {
                const res = await fetch(
                    `${config.backendURL[globalCtx.getState().processing]}/${config.backendRoutes.GET_POST_LINK_FROM_ID}`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ postId, commentSlice, workspaceId })
                    }
                );
                const data = await res.json();

                electronLogger.log('Data from backend:', data);
                return data.link;
            }
            let link = '';

            await logger.info('Getting link from post:', postId);
            electronLogger.log('Post Data:', postData, commentSlice);

            const normalizeText = (text) => text.toLowerCase().replace(/\s+/g, ' ').trim();

            const normalizedCommentSlice = normalizeText(commentSlice);

            if (
                normalizeText(postData.title).includes(normalizedCommentSlice) ||
                normalizeText(postData.selftext).includes(normalizedCommentSlice)
            ) {
                electronLogger.log('Found in post:', postId);
                await logger.info('Link found (post):', postId);
                link = linkCreator(postId, 'post', postId, postData.subreddit);
            } else {
                const searchSlice = (comment, normalizedCommentSlice) => {
                    if (!normalizedCommentSlice) {
                        electronLogger.error('Selected text is empty or null');
                        return null;
                    }

                    const normalizedBody = normalizeText(comment?.body || '');

                    if (normalizedBody.includes(normalizedCommentSlice)) {
                        electronLogger.log('Found in comment:', comment.body);
                        return comment.id;
                    }

                    if (comment?.comments?.length) {
                        for (const subComment of comment.comments) {
                            const result = searchSlice(subComment, normalizedCommentSlice);
                            if (result) {
                                return result;
                            }
                        }
                    }

                    return null;
                };

                let commentId = null;
                if (postData.comments?.length) {
                    for (const comment of postData.comments) {
                        const result = searchSlice(comment, normalizedCommentSlice);
                        if (result) {
                            commentId = result;
                            break;
                        }
                    }
                }

                if (commentId) {
                    electronLogger.log('Found in comment:', commentId);
                    link = linkCreator(commentId, 'comment', postId, postData.subreddit);
                }
            }

            electronLogger.log('Link:', link);

            if (link) {
                await logger.info('Link found (Comment):-', link);
                return link;
            }

            await logger.info('Link not found for:', postId);
            return linkCreator(postId, 'post', postId, postData.subreddit);
        }
    );

    ipcMain.handle('capture-reddit-screenshot', async (event, url) => {
        const chromeLauncher = await import('chrome-launcher');
        const chromePath = chromeLauncher.Launcher.getInstallations()[0];

        const browser = await puppeteer.launch({
            headless: true,
            executablePath: chromePath,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process'
            ]
        });

        try {
            const page = await browser.newPage();

            await page.setUserAgent(
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
            );

            await page.setViewport({ width: 1280, height: 800 });

            await page.goto(url, { waitUntil: 'networkidle2' });

            const screenshotBuffer = await page.screenshot({ fullPage: true });
            await browser.close();

            return {
                success: true,
                image: screenshotBuffer.toString('base64'),
                buffer: screenshotBuffer
            };
        } catch (error) {
            electronLogger.error('Error capturing Reddit screenshot:', error);
            await browser.close();
            return { success: false, error: error.message };
        }
    });
};

module.exports = { redditHandler };

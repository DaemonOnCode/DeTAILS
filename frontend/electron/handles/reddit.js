const { ipcMain, BrowserView } = require('electron');
const puppeteer = require('puppeteer-core');
const { initDatabase, getCommentsRecursive, getPostById } = require('../utils/db-helpers');
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
        async (event, url, text, postId = '', datasetId = '', getFromPostData = true) => {
            electronLogger.log('url', url, globalCtx.getState());
            if (url.startsWith('/r/')) {
                url = 'https://www.reddit.com' + url;
            }
            // if (url.length === 6) {
            //     url = 'https://www.reddit.com/r/' + url;
            // }
            // Remove existing BrowserView if it exists
            electronLogger.log('sentence', text);

            let postData = null;
            if (getFromPostData) {
                if (!postId) {
                    electronLogger.log('URL', url);
                    filteredUrl = url.split('https://www.reddit.com/r/uwaterloo/comments/');

                    postId = filteredUrl[1].split('/')[0];
                }

                electronLogger.log('postId', postId);

                const url = `${config.backendURL[globalCtx.getState().processing]}/${config.backendRoutes.GET_REDDIT_POST_BY_ID}`;

                console.log('url', url, postId, datasetId);

                const res = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-App-Id': globalCtx.getState().settings.app.id
                    },
                    body: JSON.stringify({ postId, datasetId })
                });
                postData = await res.json();
                // return data.link;
            }

            electronLogger.log('postData', postData);

            if (globalCtx.getState().browserView) {
                globalCtx.getState().mainWindow.removeBrowserView(globalCtx.getState().browserView);
                // globalCtx.getState().browserView.destroy();
                globalCtx.setState({ browserView: null });
            }

            const view = new BrowserView({
                webPreferences: {
                    contextIsolation: false,
                    nodeIntegration: false,
                    webSecurity: false
                }
            });

            // Add the BrowserView to the main window
            globalCtx.getState().mainWindow.setBrowserView(view);

            const viewWidth = 800;
            const viewHeight = 600;

            const [mainWidth, mainHeight] = globalCtx.getState().mainWindow.getContentSize();

            // Calculate centered position
            const x = Math.round((mainWidth - viewWidth) / 2);
            const y = Math.round((mainHeight - viewHeight) / 2);

            // Set bounds for the BrowserView
            view.setBounds({ x, y, width: viewWidth, height: viewHeight });
            view.setAutoResize({ width: true, height: true, x: true, y: true });

            const handleRedirect = (event, newUrl) => {
                electronLogger.log('Redirect detected to:', newUrl);
                url = newUrl; // Update the URL to reflect the redirected URL
            };

            // Listen for redirects and navigation events
            view.webContents.session.webRequest.onBeforeRedirect((details) => {
                electronLogger.log('Redirect detected via webRequest:', details.redirectURL);
                url = details.redirectURL; // Update the URL with the redirect destination
            });

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
                    await view.webContents.loadFile(templatePath);
                } catch (error) {
                    electronLogger.error('Error loading template:', error);
                }
            }
            // view.webContents.on('console-message', (event, level, message) => {
            //     electronLogger.log(`BrowserView log [${level}]: ${message}`);
            // });

            // view.webContents.openDevTools();

            electronLogger.log('text', text);
            // view.webContents
            //     .executeJavaScript(
            //         `
            //             (function() {
            //                 electronLogger.log('JavaScript execution started');
            //                 // Your JavaScript logic here
            //                 electronLogger.log('JavaScript execution finished');
            //             })();
            //         `
            //     )
            //     .catch((error) => {
            //         electronLogger.error('Error executing JavaScript:', error);
            // //     });
            // view.webContents.on('did-stop-loading', (...e) => {
            //     electronLogger.error('Failed to load file', e);
            // });

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
                                const highlightColor = '#FFF9C4'; // Soft pastel yellow for highlighting
                                const textColor = '#000000'; // Black text color for readability
                                const highlightClass = 'highlighted-sentence';
                        
                                // Add CSS for the highlight class
                                const style = document.createElement('style');
                                style.innerHTML = \`
                                    .\${highlightClass} {
                                    background-color: \${highlightColor};
                                    color: \${textColor}; /* Set text color to black */
                                    transition: background-color 0.5s ease;
                                    padding: 2px; /* Add a bit of padding to make the highlight clearer */
                                    border-radius: 4px; /* Rounded edges for a subtle highlight */
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
                        
                                        // Create a span wrapper to apply the highlight
                                        const span = document.createElement('span');
                                        span.className = highlightClass;
                                        span.textContent = sentence;
                        
                                        range.deleteContents();
                                        range.insertNode(span);
                        
                                        // Scroll to the highlighted text
                                        span.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        return true;
                                    }
                                    }
                                    return false;
                                }
                        
                                function searchAndHighlight(node, sentence) {
                                    for (let child of node.childNodes) {
                                    if (highlightExactText(child, sentence)) {
                                        return; // Stop after the first exact match is highlighted
                                    }
                                    searchAndHighlight(child, sentence); // Recursively search in child nodes
                                    }
                                }
                        
                                // Start searching from the body element
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
            // view.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
            //     electronLogger.error(`Failed to load file: ${errorCode} - ${errorDescription}`);
            // });
            // const eventsToLog = [
            //     'did-finish-load',
            //     'did-fail-load',
            //     'did-start-loading',
            //     'did-stop-loading',
            //     'dom-ready',
            //     'did-frame-finish-load',
            //     'did-navigate',
            //     'did-navigate-in-page',
            //     'will-navigate',
            //     'new-window',
            //     'console-message',
            //     'crashed',
            //     'unresponsive',
            //     'responsive',
            //     'ipc-message',
            //     'ipc-message-sync',
            //     'media-started-playing',
            //     'media-paused',
            //     'did-change-theme-color',
            //     'devtools-opened',
            //     'devtools-closed',
            //     'devtools-focused'
            // ];

            // eventsToLog.forEach((event) => {
            //     view.webContents.on(event, (...args) => {
            //         electronLogger.log(`[webContents event] ${event}:`, args);
            //     });
            // });

            globalCtx.setState({ browserView: view });

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

            // Check if the BrowserView’s webContents is still alive, then destroy it
            if (currentView.webContents && !currentView.webContents.isDestroyed()) {
                currentView.webContents.destroy();
            }

            // Finally, clear the reference
            globalCtx.setState({ browserView: null });
        }
    });

    const linkCreator = (id, type, postId, subreddit) => {
        if (type === 'post') {
            return `https://www.reddit.com/r/${subreddit}/comments/${postId}/`;
        } else if (type === 'comment') {
            return `https://www.reddit.com/r/${subreddit}/comments/${postId}/${id}/`;
        }
    };

    ipcMain.handle('get-link-from-post', async (event, postId, commentSlice, datasetId, dbPath) => {
        electronLogger.log(
            'get-link-from-post',
            postId,
            commentSlice,
            datasetId,
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
                    body: JSON.stringify({ postId, commentSlice, datasetId })
                }
            );
            const data = await res.json();

            electronLogger.log('Data from backend:', data);
            return data.link;
        }

        // const db = initDatabase(dbPath);
        // const postData = await getPostById(
        //     db,
        //     postId,
        //     ['selftext', 'title', 'subreddit', 'url', 'permalink'],
        //     ['parent_id', 'body', 'id']
        // );

        let link = '';

        await logger.info('Getting link from post:', postId);
        electronLogger.log('Post Data:', postData, commentSlice);

        const normalizeText = (text) => text.toLowerCase().replace(/\s+/g, ' ').trim();

        const normalizedCommentSlice = normalizeText(commentSlice);

        // Corrected the comparison to use normalizedCommentSlice
        if (
            normalizeText(postData.title).includes(normalizedCommentSlice) ||
            normalizeText(postData.selftext).includes(normalizedCommentSlice)
        ) {
            electronLogger.log('Found in post:', postId);
            await logger.info('Link found (post):', postId);
            link = linkCreator(postId, 'post', postId, postData.subreddit);
        } else {
            // Adjusted searchSlice function to return the commentId
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

            // Corrected the way commentId is assigned
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
    });

    ipcMain.handle('capture-reddit-screenshot', async (event, url) => {
        const chromeLauncher = await import('chrome-launcher');
        const chromePath = chromeLauncher.Launcher.getInstallations()[0];

        // Launch Puppeteer browser
        const browser = await puppeteer.launch({
            headless: true, // Headless mode for screenshot capture
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

            // Set user agent to avoid blocks by Reddit
            await page.setUserAgent(
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
            );

            // Set viewport for consistent rendering
            await page.setViewport({ width: 1280, height: 800 });

            // Navigate to the URL
            await page.goto(url, { waitUntil: 'networkidle2' });

            // Take a screenshot
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

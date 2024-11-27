const { ipcMain, BrowserView } = require('electron');
const puppeteer = require('puppeteer-core');
const config = require('../utils/config');
const { initDatabase, getCommentsRecursive, getPostById } = require('../utils/db_helpers');
const logger = require('../utils/logger');

const redditHandler = () => {
    ipcMain.handle('fetch-reddit-content', async (event, url) => {
        try {
            await logger.info('Fetching Reddit content:', url);
            const content = await fetchRedditContent(url);
            return content;
        } catch (error) {
            await logger.error('Error fetching Reddit content:', error);
            console.error('Error fetching Reddit content:', error);
            return { error: 'Failed to fetch content' };
        }
    });

    ipcMain.handle('render-reddit-webview', async (event, url, text) => {
        console.log('url', url);
        // if (url.length === 6) {
        //     url = 'https://www.reddit.com/r/' + url;
        // }
        // Remove existing BrowserView if it exists
        console.log('sentence', text);

        if (config.browserView) {
            config.mainWindow.removeBrowserView(config.browserView);
            // config.browserView.destroy();
            config.browserView = null;
        }

        const view = new BrowserView({
            webPreferences: {
                contextIsolation: true,
                nodeIntegration: false,
                webSecurity: false
            }
        });

        // Add the BrowserView to the main window
        config.mainWindow.setBrowserView(view);

        const viewWidth = 800;
        const viewHeight = 600;

        const [mainWidth, mainHeight] = config.mainWindow.getContentSize();

        // Calculate centered position
        const x = Math.round((mainWidth - viewWidth) / 2);
        const y = Math.round((mainHeight - viewHeight) / 2);

        // Set bounds for the BrowserView
        view.setBounds({ x, y, width: viewWidth, height: viewHeight });
        view.setAutoResize({ width: true, height: true, x: true, y: true });

        const handleRedirect = (event, newUrl) => {
            console.log('Redirect detected to:', newUrl);
            url = newUrl; // Update the URL to reflect the redirected URL
        };

        // Listen for redirects and navigation events
        view.webContents.session.webRequest.onBeforeRedirect((details) => {
            console.log('Redirect detected via webRequest:', details.redirectURL);
            url = details.redirectURL; // Update the URL with the redirect destination
        });

        // Load the URL
        await logger.info('Loading Reddit content:', url);
        view.webContents.loadURL(url);

        if (text) {
            view.webContents.on('did-finish-load', () => {
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
                        console.error('Error executing injected script:', error);
                    });
            });
        }

        config.browserView = view;

        return {
            success: true,
            bounds: view.getBounds()
        };
    });

    ipcMain.handle('close-reddit-webview', async (event) => {
        if (config.browserView) {
            await logger.info('Closing Reddit BrowserView');
            config.mainWindow.removeBrowserView(config.browserView);
            config.browserView = null;
        }
    });

    const linkCreator = (id, type, postId, subreddit) => {
        if (type === 'post') {
            return `https://www.reddit.com/r/${subreddit}/comments/${postId}/`;
        } else if (type === 'comment') {
            return `https://www.reddit.com/r/${subreddit}/comments/${postId}/${id}/`;
        }
    };

    ipcMain.handle('get-link-from-post', async (event, postId, commentSlice, dbPath) => {
        const db = initDatabase(dbPath);
        const postData = await getPostById(
            db,
            postId,
            ['selftext', 'title', 'subreddit', 'url', 'permalink'],
            ['parent_id', 'body', 'id']
        );

        let link = '';

        await logger.info('Getting link from post:', postId);
        console.log('Post Data:', postData, commentSlice);

        const normalizeText = (text) => text.toLowerCase().replace(/\s+/g, ' ').trim();

        const normalizedCommentSlice = normalizeText(commentSlice);

        // Corrected the comparison to use normalizedCommentSlice
        if (
            normalizeText(postData.title).includes(normalizedCommentSlice) ||
            normalizeText(postData.selftext).includes(normalizedCommentSlice)
        ) {
            console.log('Found in post:', postId);
            await logger.info('Link found (post):', postId);
            link = linkCreator(postId, 'post', postId, postData.subreddit);
        } else {
            // Adjusted searchSlice function to return the commentId
            const searchSlice = (comment, normalizedCommentSlice) => {
                if (!normalizedCommentSlice) {
                    console.error('Selected text is empty or null');
                    return null;
                }

                const normalizedBody = normalizeText(comment?.body || '');

                if (normalizedBody.includes(normalizedCommentSlice)) {
                    console.log('Found in comment:', comment.body);
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
                console.log('Found in comment:', commentId);
                link = linkCreator(commentId, 'comment', postId, postData.subreddit);
            }
        }

        console.log('Link:', link);

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
            console.error('Error capturing Reddit screenshot:', error);
            await browser.close();
            return { success: false, error: error.message };
        }
    });
};

module.exports = { redditHandler };

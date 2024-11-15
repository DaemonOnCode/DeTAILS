const {
  app,
  BrowserWindow,
  BrowserView,
  ipcMain,
  dialog,
  WebContentsView,
  webContents,
  session,
} = require("electron");
const { autoUpdater } = require("electron-updater");
const { createMainWindow } = require("./utils/createMainWindow");
const AutoLaunch = require("auto-launch");
const remote = require("@electron/remote/main");
const config = require("./utils/config");

const puppeteer = require("puppeteer-core");

if (config.isDev) require("electron-reloader")(module);

remote.initialize();

if (!config.isDev) {
  const autoStart = new AutoLaunch({
    name: config.appName,
  });
  autoStart.enable();
}

app.on("ready", async () => {
  config.mainWindow = await createMainWindow();
  // config.tray = createTray();
  // config.popupWindow = await createPopupWindow();

  // showNotification(
  // 	config.appName,
  // 	"Application running on background! See application tray.",
  // );
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0)
    config.mainWindow = createMainWindow();
});

ipcMain.on("app_version", (event) => {
  event.sender.send("app_version", { version: app.getVersion() });
});

autoUpdater.on("update-available", () => {
  config.mainWindow.webContents.send("update_available");
});

autoUpdater.on("update-downloaded", () => {
  config.mainWindow.webContents.send("update_downloaded");
});

ipcMain.on("restart_app", () => {
  autoUpdater.quitAndInstall();
});

ipcMain.handle("select-folder", async () => {
  const result = await dialog.showOpenDialog(config.mainWindow, {
    properties: ["openDirectory"],
  });
  return result.filePaths[0]; // Return the selected folder path
});

ipcMain.handle("fetch-reddit-content", async (event, url) => {
  try {
    const content = await fetchRedditContent(url);
    return content;
  } catch (error) {
    console.error("Error fetching Reddit content:", error);
    return { error: "Failed to fetch content" };
  }
});

ipcMain.handle("render-reddit-webview", async (event, url, text) => {
  // Remove existing BrowserView if it exists
  console.log("sentence", text);

  if (config.browserView) {
    config.mainWindow.removeBrowserView(config.browserView);
    config.browserView.destroy();
    config.browserView = null;
  }

  // Create a new BrowserView
  const view = new BrowserView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false, // Adjust as needed
    },
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

  // Load the URL
  view.webContents.loadURL(url);

  view.webContents.on("did-finish-load", () => {
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
      .catch((error) => {
        console.error("Error executing injected script:", error);
      });
  });

  // Store the BrowserView reference
  config.browserView = view;

  return {
    success: true,
    bounds: view.getBounds(),
  };
});

ipcMain.handle("close-reddit-webview", async (event) => {
  if (config.browserView) {
    config.mainWindow.removeBrowserView(config.browserView);
    // config.browserView.destroy();
    config.browserView = null;
  }
});

ipcMain.handle("capture-reddit-screenshot", async (event, url) => {
  const chromeLauncher = await import("chrome-launcher");
  const chromePath = chromeLauncher.Launcher.getInstallations()[0];

  // Launch Puppeteer browser
  const browser = await puppeteer.launch({
    headless: true, // Headless mode for screenshot capture
    executablePath: chromePath,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-web-security",
      "--disable-features=IsolateOrigins,site-per-process",
    ],
  });

  try {
    const page = await browser.newPage();

    // Set user agent to avoid blocks by Reddit
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
    );

    // Set viewport for consistent rendering
    await page.setViewport({ width: 1280, height: 800 });

    // Navigate to the URL
    await page.goto(url, { waitUntil: "networkidle2" });

    // Take a screenshot
    const screenshotBuffer = await page.screenshot({ fullPage: true });
    await browser.close();

    return {
      success: true,
      image: screenshotBuffer.toString("base64"),
      buffer: screenshotBuffer,
    };
  } catch (error) {
    console.error("Error capturing Reddit screenshot:", error);
    await browser.close();
    return { success: false, error: error.message };
  }
});

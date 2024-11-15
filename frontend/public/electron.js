const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
// const { createTray } = require("./utils/createTray");
const { createMainWindow } = require("./utils/createMainWindow");
// const { createPopupWindow } = require("./utils/createPopupWindow");
// const { showNotification } = require("./utils/showNotification");
const AutoLaunch = require("auto-launch");
// const { Launcher } = require("chrome-launcher");
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

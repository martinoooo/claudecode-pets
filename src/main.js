const { app, BrowserWindow, screen, ipcMain } = require("electron");
const { fork } = require("child_process");
const path = require("path");

let mainWindow = null;
let serverProcess = null;

function createWindow() {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: 180,
    height: 180,
    x: screenWidth - 200,
    y: screenHeight - 200,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    hasShadow: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));
  mainWindow.setVisibleOnAllWorkspaces(true);
}

function startServer() {
  serverProcess = fork(path.join(__dirname, "server.js"), [], {
    silent: true,
    env: { ...process.env },
  });
  serverProcess.stdout.on("data", (d) => process.stdout.write(`[server] ${d}`));
  serverProcess.stderr.on("data", (d) => process.stderr.write(`[server] ${d}`));
  serverProcess.on("exit", (code) => {
    if (code !== 0) console.error(`Server exited with code ${code}`);
  });
}

// IPC: move window (called from renderer for drag)
ipcMain.on("move-window", (_, dx, dy) => {
  if (mainWindow) {
    const [x, y] = mainWindow.getPosition();
    mainWindow.setPosition(x + dx, y + dy);
  }
});

app.whenReady().then(() => {
  startServer();
  // Give server a moment to start before window loads
  setTimeout(createWindow, 800);
});

app.on("window-all-closed", () => {
  if (serverProcess) serverProcess.kill();
  app.quit();
});

app.on("before-quit", () => {
  if (serverProcess) serverProcess.kill();
});

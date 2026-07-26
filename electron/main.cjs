/* eslint-disable @typescript-eslint/no-require-imports */
const {
  app,
  BrowserWindow,
  Menu,
  dialog,
  shell,
  utilityProcess,
} = require("electron");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");

const LOOPBACK_HOST = "127.0.0.1";
const STARTUP_TIMEOUT_MS = 45_000;

let mainWindow;
let serverProcess;
let shuttingDown = false;
let logFilePath;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(createApplication).catch(showStartupFailure);
}

app.on("before-quit", () => {
  shuttingDown = true;
  serverProcess?.kill();
});

app.on("window-all-closed", () => {
  app.quit();
});

async function createApplication() {
  app.setAppUserModelId("com.promptcraft.studio");
  Menu.setApplicationMenu(null);

  const developmentUrl = process.env.ELECTRON_START_URL;
  const applicationUrl = developmentUrl ?? await startPackagedServer();

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    backgroundColor: "#1e1e1e",
    title: "Prompt Craft Studio",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const applicationOrigin = new URL(applicationUrl).origin;
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (new URL(url).origin === applicationOrigin) return;
    event.preventDefault();
    if (url.startsWith("https://")) void shell.openExternal(url);
  });
  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("closed", () => {
    mainWindow = undefined;
  });

  await mainWindow.loadURL(applicationUrl);
}

async function startPackagedServer() {
  const serverDirectory = path.join(process.resourcesPath, "app-server");
  const dataDirectory =
    process.env.PROMPT_CRAFT_DATA_DIR ||
    path.join(app.getPath("userData"), "workspace");
  fs.mkdirSync(dataDirectory, { recursive: true });
  logFilePath = path.join(dataDirectory, "desktop.log");
  const environment = {
    ...process.env,
    NODE_ENV: "production",
    HOSTNAME: LOOPBACK_HOST,
    PROMPT_CRAFT_DATA_DIR: dataDirectory,
  };

  await runSetup(
    path.join(serverDirectory, "scripts", "prepare-local-data.mjs"),
    serverDirectory,
    environment,
  );

  const port = await reservePort();
  const serverUrl = `http://${LOOPBACK_HOST}:${port}`;
  writeLog(`server: starting ${serverUrl}`);
  serverProcess = utilityProcess.fork(
    path.join(serverDirectory, "server.js"),
    [],
    {
      cwd: serverDirectory,
      env: { ...environment, PORT: String(port) },
      serviceName: "Prompt Craft Local Server",
      stdio: "pipe",
    },
  );
  pipeUtilityLogs(serverProcess, "server");
  serverProcess.on("exit", (code) => {
    if (shuttingDown) return;
    showStartupFailure(
      new Error(`The local application server stopped unexpectedly (${code}).`),
    );
  });

  await waitForHealth(`${serverUrl}/api/health`);
  return serverUrl;
}

function runSetup(modulePath, cwd, env) {
  return new Promise((resolve, reject) => {
    const child = utilityProcess.fork(modulePath, [], {
      cwd,
      env,
      serviceName: "Prompt Craft Data Setup",
      stdio: "pipe",
    });
    pipeUtilityLogs(child, "setup");
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Local data initialization failed (${code}).`));
    });
  });
}

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, LOOPBACK_HOST, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((error) => {
        if (error) reject(error);
        else if (port) resolve(port);
        else reject(new Error("Unable to allocate a local port."));
      });
    });
  });
}

async function waitForHealth(url) {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The local server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("The local application server did not become ready in time.");
}

function showStartupFailure(error) {
  const message = error instanceof Error ? error.message : String(error);
  writeLog(`startup: ${message}`);
  dialog.showErrorBox(
    "Prompt Craft Studio 启动失败",
    `${message}\n\n请重新启动应用；如仍失败，请备份用户数据目录后查看故障排查文档。`,
  );
  app.quit();
}

function pipeUtilityLogs(child, label) {
  child.stdout?.on("data", (chunk) => writeLog(`${label}: ${chunk}`));
  child.stderr?.on("data", (chunk) => writeLog(`${label}: ${chunk}`));
}

function writeLog(message) {
  if (!logFilePath) return;
  try {
    fs.appendFileSync(
      logFilePath,
      `[${new Date().toISOString()}] ${String(message).trim()}\n`,
      "utf8",
    );
  } catch {
    // Logging must never prevent startup or shutdown.
  }
}

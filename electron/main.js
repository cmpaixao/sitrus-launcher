const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const {
  loginMicrosoft,
  loginOffline,
  restoreAccount,
  clearAccount,
  readAccount,
  publicAccount,
} = require("./auth");
const { loadPackConfig, loadSettings, saveSettings } = require("./settings");
const { ensureJava } = require("./java");
const { ensurePack, packStatus } = require("./installer");
const { launchGame } = require("./game");
const { searchExtras, listExtraVersions, installExtra, applyExtras, removeExtra, packFolder, packCompat } = require("./extras");
const { setupAutoUpdate } = require("./updater");
const { shareLatestLog } = require("./logs");
const { pingServer } = require("./status");

app.setName("Sitrus Launcher");
if (process.platform === "win32") {
  app.setAppUserModelId("com.sitrus.launcher");
}

let mainWindow = null;
let launching = false;

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 740,
    minWidth: 1100,
    minHeight: 680,
    frame: false,
    backgroundColor: "#0E0C0A",
    icon: path.join(__dirname, "..", "assets", "icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
}

app.whenReady().then(() => {
  createWindow();
  setupAutoUpdate(send);
});
app.on("window-all-closed", () => app.quit());

ipcMain.handle("window:minimize", () => mainWindow?.minimize());
ipcMain.handle("window:maximize", () => {
  if (!mainWindow) return false;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
  return mainWindow.isMaximized();
});
ipcMain.handle("window:close", () => mainWindow?.close());
ipcMain.handle("open:external", (_e, url) => shell.openExternal(url));

ipcMain.handle("app:bootstrap", async () => {
  const pack = loadPackConfig();
  const settings = loadSettings();
  const account = await restoreAccount();
  const status = await packStatus(pack.modrinthSlug);
  const server = await pingServer(settings.serverAddress, settings.serverPort);
  return { pack, settings, account, status, server, launcherVersion: app.getVersion(), compat: packCompat() };
});

ipcMain.handle("settings:save", (_e, partial) => saveSettings(partial));

ipcMain.handle("auth:microsoft", async () => loginMicrosoft());
ipcMain.handle("auth:offline", async (_e, name) => loginOffline(name));
ipcMain.handle("auth:logout", async () => {
  clearAccount();
  return null;
});

ipcMain.handle("game:play", async () => {
  if (launching) return { ok: false, message: "O launcher já está preparando o jogo." };
  launching = true;
  try {
    const pack = loadPackConfig();
    const settings = loadSettings();
    const account = readAccount();
    if (!account) throw new Error("Entre com uma conta antes de jogar.");

    send("game:progress", { phase: "java", message: "Preparando Java 21...", percent: 3 });
    const javaPath = await ensureJava(settings.javaPath, (progress) => send("game:progress", progress));

    send("game:progress", { phase: "pack", message: "Buscando atualização do pack...", percent: 10 });
    await ensurePack(pack.modrinthSlug, (progress) => send("game:progress", progress), {
      checkUpdates: true,
    });

    send("game:progress", { phase: "extras", message: "Reaplicando extras do jogador...", percent: 92 });
    await applyExtras();

    send("game:progress", { phase: "launch", message: "Abrindo o Minecraft...", percent: 96 });
    launchGame({
      account,
      javaPath,
      ramGb: settings.ramGb,
      server: {
        address: settings.serverAddress,
        port: settings.serverPort,
      },
      onProgress: (progress) => send("game:progress", progress),
      onLog: (line) => send("game:log", line),
      onClose: (code) => {
        launching = false;
        send("game:closed", { code: Number(code) || 0 });
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show();
      },
    });

    if (settings.closeOnPlay) {
      mainWindow?.hide();
    }
    return { ok: true, account: publicAccount(account) };
  } catch (error) {
    launching = false;
    send("game:progress", { phase: "error", message: error.message, percent: 0 });
    return { ok: false, message: error.message };
  }
});

ipcMain.handle("extras:search", async (_e, payload) => searchExtras(payload || {}));
ipcMain.handle("extras:versions", async (_e, payload) => listExtraVersions(payload?.id, payload?.type));
ipcMain.handle("extras:install", async (_e, payload) => {
  try {
    return await installExtra(payload?.id, payload?.type, payload?.versionId);
  } catch (error) {
    console.error("extras:install", payload, error);
    throw error;
  }
});
ipcMain.handle("server:status", async () => {
  const settings = loadSettings();
  return pingServer(settings.serverAddress, settings.serverPort);
});
ipcMain.handle("extras:remove", async (_e, id) => removeExtra(id));
ipcMain.handle("app:openFolder", async (_e, kind) => {
  const target = packFolder(kind || "root");
  const err = await shell.openPath(target);
  if (err) throw new Error(`Não deu para abrir a pasta: ${err}`);
  return target;
});
ipcMain.handle("logs:share", async () => shareLatestLog());

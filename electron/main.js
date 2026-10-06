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
const { searchExtras, installExtra, removeExtra, packFolder, packCompat } = require("./extras");
const { setupAutoUpdate } = require("./updater");
const { shareLatestLog } = require("./logs");

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
    width: 1180,
    height: 720,
    minWidth: 1040,
    minHeight: 640,
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
  return { pack, settings, account, status, launcherVersion: app.getVersion(), compat: packCompat() };
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

    send("game:progress", { phase: "pack", message: settings.checkUpdatesOnPlay ? "Buscando atualização do pack..." : "Preparando o pack Sitrus...", percent: 10 });
    await ensurePack(pack.modrinthSlug, (progress) => send("game:progress", progress), {
      checkUpdates: Boolean(settings.checkUpdatesOnPlay),
    });

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
ipcMain.handle("extras:install", async (_e, payload) => {
  try {
    return await installExtra(payload?.id, payload?.type, payload?.loader);
  } catch (error) {
    console.error("extras:install", payload, error);
    throw error;
  }
});
ipcMain.handle("extras:remove", async (_e, id) => removeExtra(id));
ipcMain.handle("app:openFolder", async (_e, kind) => {
  const target = packFolder(kind || "root");
  const err = await shell.openPath(target);
  if (err) throw new Error(`Não deu para abrir a pasta: ${err}`);
  return target;
});
ipcMain.handle("logs:share", async () => shareLatestLog());

const { app, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");

function isPortable() {
  return Boolean(process.env.PORTABLE_EXECUTABLE_DIR);
}

function canAutoUpdate() {
  return app.isPackaged && !isPortable();
}

function setupAutoUpdate(send) {
  ipcMain.handle("app:installUpdate", () => {
    if (!canAutoUpdate()) return false;
    autoUpdater.quitAndInstall(false, true);
    return true;
  });

  if (!canAutoUpdate()) {
    send("app:update", { status: isPortable() ? "portable" : "dev" });
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;

  autoUpdater.on("checking-for-update", () => {
    send("app:update", { status: "checking" });
  });
  autoUpdater.on("update-available", (info) => {
    send("app:update", { status: "available", version: info.version });
  });
  autoUpdater.on("update-not-available", () => {
    send("app:update", { status: "idle" });
  });
  autoUpdater.on("download-progress", (progress) => {
    send("app:update", {
      status: "downloading",
      percent: Number(progress.percent) || 0,
    });
  });
  autoUpdater.on("update-downloaded", (info) => {
    send("app:update", { status: "ready", version: info.version });
  });
  autoUpdater.on("error", (error) => {
    send("app:update", {
      status: "error",
      message: error?.message || "Falha ao atualizar o launcher.",
    });
  });

  const check = () => {
    autoUpdater.checkForUpdates().catch((error) => {
      send("app:update", {
        status: "error",
        message: error?.message || "Falha ao atualizar o launcher.",
      });
    });
  };

  setTimeout(check, 4000);
  setInterval(check, 6 * 60 * 60 * 1000);
}

module.exports = { setupAutoUpdate };

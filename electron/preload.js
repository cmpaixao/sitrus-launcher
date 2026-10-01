const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("sitrus", {
  bootstrap: () => ipcRenderer.invoke("app:bootstrap"),
  saveSettings: (partial) => ipcRenderer.invoke("settings:save", partial),
  loginMicrosoft: () => ipcRenderer.invoke("auth:microsoft"),
  loginOffline: (name) => ipcRenderer.invoke("auth:offline", name),
  logout: () => ipcRenderer.invoke("auth:logout"),
  play: () => ipcRenderer.invoke("game:play"),
  searchExtras: (payload) => ipcRenderer.invoke("extras:search", payload),
  installExtra: (payload) => ipcRenderer.invoke("extras:install", payload),
  removeExtra: (id) => ipcRenderer.invoke("extras:remove", id),
  minimize: () => ipcRenderer.invoke("window:minimize"),
  maximize: () => ipcRenderer.invoke("window:maximize"),
  close: () => ipcRenderer.invoke("window:close"),
  openExternal: (url) => ipcRenderer.invoke("open:external", url),
  onProgress: (cb) => ipcRenderer.on("game:progress", (_e, data) => cb(data)),
  onClosed: (cb) => ipcRenderer.on("game:closed", () => cb()),
});

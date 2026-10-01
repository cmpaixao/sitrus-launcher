const path = require("path");
const { app } = require("electron");

function userData() {
  return app.getPath("userData");
}

function minecraftRoot() {
  return path.join(userData(), "minecraft");
}

function runtimeRoot() {
  return path.join(userData(), "runtime");
}

function accountFile() {
  return path.join(userData(), "account.json");
}

function settingsFile() {
  return path.join(userData(), "settings.json");
}

function instanceFile() {
  return path.join(minecraftRoot(), "sitrus-instance.json");
}

function extrasFile() {
  return path.join(userData(), "extras.json");
}

function configPath() {
  return path.join(app.getAppPath(), "sitrus.config.json");
}

module.exports = {
  userData,
  minecraftRoot,
  runtimeRoot,
  accountFile,
  settingsFile,
  instanceFile,
  extrasFile,
  configPath,
};

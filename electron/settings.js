const fs = require("fs");
const path = require("path");
const { configPath, settingsFile } = require("./paths");

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function loadPackConfig() {
  return readJson(configPath(), {
    launcherName: "Sitrus Launcher",
    modrinthSlug: "sitrus-cobblemon",
    discord: "https://discord.gg/wbavFswmkr",
    wiki: "https://wiki-sitruscobblemon.com.br/",
    store: "https://sitruscobblemon.craftingstore.net/",
    server: { name: "Sitrus Cobblemon", address: "sitruscobblemon.com", port: 25565 },
  });
}

function defaultSettings() {
  const pack = loadPackConfig();
  return {
    ramGb: 4,
    closeOnPlay: false,
    javaPath: "",
    serverAddress: pack.server?.address || "",
    serverPort: pack.server?.port || 25565,
    checkUpdatesOnPlay: true,
    lastTab: "home",
  };
}

function loadSettings() {
  const defaults = defaultSettings();
  const saved = readJson(settingsFile(), {});
  const merged = { ...defaults, ...saved };
  if (!String(merged.serverAddress || "").trim()) {
    merged.serverAddress = defaults.serverAddress;
  }
  if (!merged.serverPort) {
    merged.serverPort = defaults.serverPort;
  }
  return merged;
}

function saveSettings(partial) {
  const next = { ...loadSettings(), ...partial };
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify(next, null, 2));
  return next;
}

module.exports = { loadPackConfig, loadSettings, saveSettings, defaultSettings };

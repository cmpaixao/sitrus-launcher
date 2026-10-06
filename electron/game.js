const { Client } = require("minecraft-launcher-core");
const { minecraftRoot } = require("./paths");
const { toMclc } = require("./auth");
const { readInstance } = require("./installer");

function launchGame({ account, javaPath, ramGb, server, onProgress, onLog, onClose }) {
  const instance = readInstance();
  if (!instance) throw new Error("O pack ainda não foi instalado.");

  const launcher = new Client();
  const host = String(server?.address || "").trim();
  const port = Number(server?.port || 25565);

  launcher.on("progress", (e) => {
    const total = e.total || 1;
    const task = e.task || 0;
    onProgress?.({
      phase: e.type || "minecraft",
      message: `Preparando Minecraft (${e.type || "download"})...`,
      percent: Math.min(99, Math.round((task / total) * 100)),
    });
  });
  launcher.on("download-status", (e) => {
    if (!e.total) return;
    onProgress?.({
      phase: "minecraft",
      message: `Baixando ${e.name || "arquivos do jogo"}...`,
      percent: Math.min(99, Math.round((e.current / e.total) * 100)),
    });
  });
  launcher.on("data", (t) => onLog?.(String(t)));
  launcher.on("debug", (t) => onLog?.(String(t)));
  launcher.on("close", (code) => onClose?.(code));

  const opts = {
    authorization: toMclc(account),
    root: minecraftRoot(),
    javaPath,
    version: {
      number: instance.mcVersion,
      type: "release",
      custom: instance.fabricId,
    },
    memory: {
      max: `${Math.max(2, Number(ramGb) || 4)}G`,
      min: "1G",
    },
    customLaunchArgs: host ? ["--quickPlayMultiplayer", `${host}:${port}`] : [],
    overrides: {
      detached: false,
      gameDirectory: minecraftRoot(),
      cwd: minecraftRoot(),
    },
  };

  launcher.launch(opts);
  return launcher;
}

module.exports = { launchGame };

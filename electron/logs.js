const fs = require("fs");
const path = require("path");
const { app, clipboard } = require("electron");
const { minecraftRoot } = require("./paths");
const { readInstance } = require("./installer");

const API = "https://api.mclo.gs/1";
const UA = "SitrusLauncher/1.1.0 (https://github.com/cmpaixao/sitrus-launcher)";
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_LINES = 25000;

function logsDir() {
  return path.join(minecraftRoot(), "logs");
}

function crashDir() {
  return path.join(minecraftRoot(), "crash-reports");
}

function newestFile(dir, pattern) {
  if (!fs.existsSync(dir)) return null;
  let best = null;
  let bestTime = 0;
  for (const name of fs.readdirSync(dir)) {
    if (!pattern.test(name)) continue;
    const full = path.join(dir, name);
    try {
      const stat = fs.statSync(full);
      if (!stat.isFile()) continue;
      if (stat.mtimeMs > bestTime) {
        best = full;
        bestTime = stat.mtimeMs;
      }
    } catch {
      // skip unreadable files
    }
  }
  return best ? { path: best, mtime: bestTime } : null;
}

function findLogFile() {
  const latest = newestFile(logsDir(), /^(latest\.log|debug\.log)$/i);
  const crash = newestFile(crashDir(), /\.(txt|log)$/i);
  if (crash && (!latest || crash.mtime >= latest.mtime)) return crash.path;
  if (latest) return latest.path;
  return null;
}

function truncateLog(text) {
  let lines = String(text || "").split(/\r?\n/);
  if (lines.length > MAX_LINES) lines = lines.slice(-MAX_LINES);
  let content = lines.join("\n").trim();
  while (content && Buffer.byteLength(content, "utf8") > MAX_BYTES) {
    const drop = Math.max(1, Math.floor(lines.length * 0.1));
    lines = lines.slice(drop);
    content = lines.join("\n").trim();
  }
  return content;
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      "User-Agent": UA,
      Accept: "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.success === false) {
    throw new Error(data?.error || `Falha no mclo.gs (${res.status})`);
  }
  return data;
}

async function fetchInsights(id) {
  try {
    return await fetchJson(`${API}/insights/${encodeURIComponent(id)}`);
  } catch {
    return null;
  }
}

function publicInsights(insights) {
  const problems = insights?.analysis?.problems || [];
  const information = insights?.analysis?.information || [];
  return {
    title: insights?.title || "",
    problems: problems.map((item) => ({
      message: item.message,
      counter: item.counter,
      solutions: (item.solutions || []).map((solution) => solution.message).filter(Boolean),
    })),
    information: information.slice(0, 8).map((item) => ({
      label: item.label,
      value: item.value,
      message: item.message,
    })),
  };
}

async function shareLatestLog() {
  const file = findLogFile();
  if (!file) {
    throw new Error("Ainda não tem log. Jogue uma vez e tente de novo.");
  }
  const raw = await fs.promises.readFile(file, "utf8");
  const content = truncateLog(raw);
  if (!content) throw new Error("O arquivo de log está vazio.");

  const instance = readInstance();
  const created = await fetchJson(`${API}/log`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content,
      source: "Sitrus Launcher",
      metadata: [
        { key: "launcher", value: app.getVersion(), label: "Launcher", visible: true },
        { key: "pack", value: instance?.versionNumber || "não instalado", label: "Pack", visible: true },
        { key: "minecraft", value: instance?.mcVersion || "1.21.1", label: "Minecraft", visible: true },
        { key: "loader", value: instance?.loader || "fabric", label: "Loader", visible: true },
        { key: "file", value: path.basename(file), label: "Arquivo", visible: true },
      ],
    }),
  });

  const insights = created.id ? await fetchInsights(created.id) : null;
  if (created.url) clipboard.writeText(created.url);

  return {
    id: created.id,
    url: created.url,
    raw: created.raw,
    errors: created.errors || 0,
    lines: created.lines || 0,
    file: path.basename(file),
    copied: true,
    insights: publicInsights(insights),
  };
}

module.exports = { shareLatestLog, findLogFile };

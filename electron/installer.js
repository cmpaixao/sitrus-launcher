const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const extractZip = require("extract-zip");
const { minecraftRoot, instanceFile, extrasFile } = require("./paths");

const UA = "SitrusLauncher/1.0.0 (https://modrinth.com/modpack/sitrus-cobblemon)";
const MODRINTH = "https://api.modrinth.com/v2";

function emit(onProgress, payload) {
  onProgress?.(payload);
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`Não consegui acessar o download (erro ${res.status}). Confira sua internet e tente de novo.`);
  return res.json();
}

async function downloadToFile(url, dest, onBytes) {
  const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow" });
  if (!res.ok) throw new Error(`O download falhou (erro ${res.status}). Confira sua internet e tente de novo.`);
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  const total = Number(res.headers.get("content-length")) || 0;
  const file = fs.createWriteStream(dest);
  const reader = res.body.getReader();
  let received = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (!file.write(Buffer.from(value))) {
        await new Promise((resolve) => file.once("drain", resolve));
      }
      onBytes?.(received, total);
    }
  } finally {
    await new Promise((resolve, reject) => {
      file.end(() => resolve());
      file.on("error", reject);
    });
  }
}

async function sha512File(file) {
  const hash = crypto.createHash("sha512");
  const stream = fs.createReadStream(file);
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest("hex");
}

async function mapPool(items, limit, worker) {
  let index = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index++;
      await worker(items[current], current);
    }
  });
  await Promise.all(runners);
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

async function latestPack(slug) {
  const project = await fetchJson(`${MODRINTH}/project/${slug}`);
  const versions = await fetchJson(`${MODRINTH}/project/${slug}/version`);
  const version = versions.find((item) => item.version_type === "release") || versions[0];
  if (!version) throw new Error("Não encontrei uma versão do modpack no Modrinth. Tente de novo daqui a pouco.");
  const file = version.files.find((item) => item.primary) || version.files[0];
  return { project, version, file };
}

async function installFabric(root, mcVersion, loaderVersion) {
  const id = `fabric-loader-${loaderVersion}-${mcVersion}`;
  const dir = path.join(root, "versions", id);
  fs.mkdirSync(dir, { recursive: true });
  const profile = await fetchJson(
    `https://meta.fabricmc.net/v2/versions/loader/${mcVersion}/${loaderVersion}/profile/json`
  );
  profile.id = id;
  fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(profile, null, 2));
  return id;
}

async function latestFabricLoader(mcVersion) {
  const loaders = await fetchJson(`https://meta.fabricmc.net/v2/versions/loader/${mcVersion}`);
  const stable = loaders.find((item) => item.loader?.stable) || loaders[0];
  if (!stable) throw new Error("Não encontrei o Fabric para Minecraft 1.21.1. Confira sua internet e tente de novo.");
  return stable.loader.version;
}

function extraFilenames() {
  try {
    const data = JSON.parse(fs.readFileSync(extrasFile(), "utf8"));
    return new Set((data.items || []).map((item) => item.filename).filter(Boolean));
  } catch {
    return new Set();
  }
}

function readInstance() {
  try {
    return JSON.parse(fs.readFileSync(instanceFile(), "utf8"));
  } catch {
    return null;
  }
}

function writeInstance(data) {
  fs.mkdirSync(path.dirname(instanceFile()), { recursive: true });
  fs.writeFileSync(instanceFile(), JSON.stringify(data, null, 2));
}

async function ensurePack(slug, onProgress, options = {}) {
  const checkUpdates = options.checkUpdates !== false;
  const root = minecraftRoot();
  fs.mkdirSync(root, { recursive: true });
  const installed = readInstance();
  const packReady = Boolean(installed && fs.existsSync(path.join(root, "mods")));

  if (packReady && !checkUpdates) {
    emit(onProgress, {
      phase: "pack",
      message: `Modpack ${installed.versionNumber} pronto.`,
      percent: 100,
    });
    return installed;
  }

  emit(onProgress, { phase: "pack", message: "Procurando atualização do modpack...", percent: 2 });

  const { version, file } = await latestPack(slug);
  if (installed?.versionId === version.id && fs.existsSync(path.join(root, "mods"))) {
    emit(onProgress, { phase: "pack", message: `Modpack ${version.version_number} já está instalado.`, percent: 100 });
    return installed;
  }

  const work = path.join(root, ".sitrus-tmp");
  if (fs.existsSync(work)) fs.rmSync(work, { recursive: true, force: true });
  fs.mkdirSync(work, { recursive: true });
  const mrpackPath = path.join(work, "pack.mrpack");

  emit(onProgress, { phase: "pack", message: `Baixando ${version.name}...`, percent: 8 });
  await downloadToFile(file.url, mrpackPath, (received, total) => {
    if (!total) return;
    emit(onProgress, {
      phase: "pack",
      message: "Baixando o modpack...",
      percent: 8 + Math.round((received / total) * 10),
    });
  });

  emit(onProgress, { phase: "pack", message: "Extraindo o modpack...", percent: 20 });
  await extractZip(mrpackPath, { dir: work });
  const index = JSON.parse(fs.readFileSync(path.join(work, "modrinth.index.json"), "utf8"));
  const mcVersion = index.dependencies?.minecraft || "1.21.1";
  const loader = index.dependencies?.["fabric-loader"]
    ? "fabric"
    : index.dependencies?.neoforge
      ? "neoforge"
      : index.dependencies?.forge
        ? "forge"
        : "fabric";
  const loaderVersion =
    index.dependencies?.["fabric-loader"] ||
    index.dependencies?.neoforge ||
    index.dependencies?.forge ||
    (loader === "fabric" ? await latestFabricLoader(mcVersion) : "");

  emit(onProgress, { phase: "fabric", message: `Instalando Fabric ${loaderVersion}...`, percent: 24 });
  const fabricId = await installFabric(root, mcVersion, loaderVersion);

  const clientFiles = (index.files || []).filter((item) => item.env?.client !== "unsupported");
  let done = 0;
  const managed = [];

  await mapPool(clientFiles, 8, async (item) => {
    const dest = path.join(root, item.path.replaceAll("/", path.sep));
    managed.push(item.path);
    const expected = item.hashes?.sha512;
    if (fs.existsSync(dest) && expected && (await sha512File(dest)) === expected) {
      done += 1;
      emit(onProgress, {
        phase: "mods",
        message: `Conferindo arquivos ${done}/${clientFiles.length}`,
        current: done,
        total: clientFiles.length,
        percent: 28 + Math.round((done / clientFiles.length) * 55),
      });
      return;
    }
    const url = item.downloads?.[0];
    if (!url) throw new Error("Um arquivo do modpack não tem link de download. Tente de novo.");
    await downloadToFile(url, dest);
    if (expected && (await sha512File(dest)) !== expected) {
      throw new Error("Um arquivo do modpack veio incompleto. Tente jogar de novo.");
    }
    done += 1;
    emit(onProgress, {
      phase: "mods",
      message: `Baixando mods ${done}/${clientFiles.length}`,
      current: done,
      total: clientFiles.length,
      percent: 28 + Math.round((done / clientFiles.length) * 55),
    });
  });

  const extraNames = extraFilenames();
  if (installed?.managedFiles?.length) {
    for (const rel of installed.managedFiles) {
      if (managed.includes(rel)) continue;
      const stale = path.join(root, rel.replaceAll("/", path.sep));
      if (extraNames.has(path.basename(stale))) continue;
      if (fs.existsSync(stale)) fs.rmSync(stale, { force: true });
    }
  }

  emit(onProgress, { phase: "overrides", message: "Aplicando as configurações do modpack...", percent: 90 });
  copyDir(path.join(work, "overrides"), root);
  copyDir(path.join(work, "client-overrides"), root);
  fs.rmSync(work, { recursive: true, force: true });

  const instance = {
    versionId: version.id,
    versionNumber: version.version_number,
    name: version.name,
    mcVersion,
    loader,
    loaderVersion,
    fabricId,
    packProjectIds: (version.dependencies || []).map((item) => item.project_id).filter(Boolean),
    managedFiles: managed,
    installedAt: new Date().toISOString(),
  };
  writeInstance(instance);
  emit(onProgress, { phase: "done", message: "Modpack instalado.", percent: 100 });
  return instance;
}

async function packStatus(slug) {
  const installed = readInstance();
  try {
    const { version } = await latestPack(slug);
    return {
      installed,
      latest: {
        versionId: version.id,
        versionNumber: version.version_number,
        name: version.name,
      },
      updateAvailable: installed?.versionId !== version.id,
    };
  } catch {
    return { installed, latest: null, updateAvailable: false };
  }
}

module.exports = { ensurePack, packStatus, readInstance, fetchJson, downloadToFile };

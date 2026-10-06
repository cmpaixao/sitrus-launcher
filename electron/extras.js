const fs = require("fs");
const path = require("path");
const { minecraftRoot, extrasFile } = require("./paths");
const { fetchJson, downloadToFile, readInstance } = require("./installer");

const MODRINTH = "https://api.modrinth.com/v2";
const IRIS_ID = "YL57xq9U";
const OCULUS_SLUG = "oculus";
const LOADERS = ["fabric", "forge", "neoforge"];
const FOLDERS = {
  mod: "mods",
  resourcepack: "resourcepacks",
  shader: "shaderpacks",
};

function emptyExtras() {
  return { items: [] };
}

function readExtras() {
  try {
    const data = JSON.parse(fs.readFileSync(extrasFile(), "utf8"));
    return { items: Array.isArray(data.items) ? data.items : [] };
  } catch {
    return emptyExtras();
  }
}

function writeExtras(data) {
  fs.mkdirSync(path.dirname(extrasFile()), { recursive: true });
  fs.writeFileSync(extrasFile(), JSON.stringify(data, null, 2));
}

function publicItem(item) {
  return {
    id: item.id,
    slug: item.slug,
    title: item.title,
    type: item.type,
    filename: item.filename,
    versionNumber: item.versionNumber,
    loader: item.loader,
  };
}

function extraFolder(type) {
  const name = FOLDERS[type];
  if (!name) throw new Error("Tipo de extra inválido.");
  const folder = path.join(minecraftRoot(), name);
  fs.mkdirSync(folder, { recursive: true });
  return folder;
}

function ensurePackFolders() {
  fs.mkdirSync(minecraftRoot(), { recursive: true });
  for (const folder of Object.values(FOLDERS)) {
    fs.mkdirSync(path.join(minecraftRoot(), folder), { recursive: true });
  }
  return minecraftRoot();
}

function packFolder(kind = "root") {
  if (kind === "root") {
    ensurePackFolders();
    return minecraftRoot();
  }
  return extraFolder(kind);
}

function safeFilename(name) {
  return path.basename(String(name || "arquivo")).replace(/[<>:"/\\|?*]/g, "_");
}

function normalizeLoader(value) {
  const loader = String(value || "").toLowerCase();
  if (loader === "neo" || loader === "neo-forge" || loader === "neoforge") return "neoforge";
  if (loader === "forge") return "forge";
  if (loader === "fabric" || loader === "quilt") return "fabric";
  return "";
}

function inferLoader(instance) {
  const stored = normalizeLoader(instance?.loader);
  if (stored) return stored;
  if (instance?.fabricId) return "fabric";
  const id = String(instance?.loaderVersion || "");
  if (/neoforge/i.test(id)) return "neoforge";
  if (/forge/i.test(id) && !/fabric/i.test(id)) return "forge";
  return "fabric";
}

function packCompat() {
  const instance = readInstance();
  return {
    mcVersion: instance?.mcVersion || "1.21.1",
    loader: inferLoader(instance),
    packLoader: inferLoader(instance),
  };
}

function loaderLabel(loader) {
  if (loader === "neoforge") return "NeoForge";
  if (loader === "forge") return "Forge";
  return "Fabric";
}

async function packProjectIds() {
  const instance = readInstance();
  if (instance?.packProjectIds?.length) return new Set(instance.packProjectIds);
  try {
    const versions = await fetchJson(`${MODRINTH}/project/sitrus-cobblemon/version`);
    const latest = versions[0];
    return new Set((latest?.dependencies || []).map((item) => item.project_id).filter(Boolean));
  } catch {
    return new Set();
  }
}

function facetsFor(type, { loader, mcVersion }) {
  const versions = [`versions:${mcVersion}`];
  if (mcVersion.startsWith("1.21")) versions.push("versions:1.21");
  if (type === "mod") {
    return [["project_type:mod"], [`versions:${mcVersion}`], [`categories:${loader}`]];
  }
  if (type === "resourcepack") {
    return [["project_type:resourcepack"], versions];
  }
  return [["project_type:shader"], ["categories:iris", "categories:optifine"]];
}

function keepHit(hit, type, packIds) {
  if (packIds.has(hit.project_id)) return false;
  if (hit.client_side === "unsupported") return false;
  if (type === "mod" && hit.server_side === "required") return false;
  return true;
}

function hitNote(hit, type) {
  if (type !== "mod") return hit.description || "";
  if (hit.server_side === "required") return "Precisa estar no servidor também.";
  if (hit.server_side === "optional") return hit.description || "Roda no client. Opcional no servidor.";
  return hit.description || "Só de client.";
}

async function pickVersion(projectId, type, { loader, mcVersion }) {
  const games = type === "resourcepack" && mcVersion.startsWith("1.21") ? [mcVersion, "1.21"] : [mcVersion];
  const loaders =
    type === "mod" ? [loader] : type === "shader" ? ["iris", "optifine"] : [];

  for (const game of games) {
    const params = new URLSearchParams();
    params.set("game_versions", JSON.stringify([game]));
    if (type === "mod") params.set("loaders", JSON.stringify([loader]));
    else if (type === "shader") params.set("loaders", JSON.stringify(loaders));
    const versions = await fetchJson(`${MODRINTH}/project/${projectId}/version?${params.toString()}`);
    const usable = (versions || []).filter((item) => item.files?.length);
    if (!usable.length) continue;
    return usable.find((item) => item.version_type === "release") || usable[0];
  }

  if (type === "shader") {
    const params = new URLSearchParams({ loaders: JSON.stringify(["iris"]) });
    const versions = await fetchJson(`${MODRINTH}/project/${projectId}/version?${params.toString()}`);
    const usable = (versions || []).filter((item) => item.files?.length);
    if (usable.length) return usable.find((item) => item.version_type === "release") || usable[0];
  }
  return null;
}

async function searchExtras({ type = "mod", query = "", offset = 0 } = {}) {
  ensurePackFolders();
  const selected = "fabric";
  const mcVersion = "1.21.1";
  const packIds = await packProjectIds();
  const extras = readExtras();
  const installedIds = new Set(extras.items.map((item) => item.id));
  const wanted = 40;
  const hits = [];
  let apiOffset = Number(offset) || 0;
  let total = 0;
  const pageSize = 50;
  const startOffset = apiOffset;

  while (hits.length < wanted && apiOffset < startOffset + 400) {
    const params = new URLSearchParams({
      limit: String(pageSize),
      offset: String(apiOffset),
      index: query.trim() ? "relevance" : "downloads",
      facets: JSON.stringify(facetsFor(type, { loader: selected, mcVersion })),
    });
    if (query.trim()) params.set("query", query.trim());

    const data = await fetchJson(`${MODRINTH}/search?${params.toString()}`);
    const batch = data.hits || [];
    total = data.total_hits || total;
    for (const hit of batch) {
      if (!keepHit(hit, type, packIds)) continue;
      hits.push({
        id: hit.project_id,
        slug: hit.slug,
        title: hit.title,
        description: hit.description || hitNote(hit, type),
        icon: hit.icon_url,
        downloads: hit.downloads || 0,
        follows: hit.follows || 0,
        categories: hit.categories || [],
        type,
        loader: selected,
        serverSide: hit.server_side,
        installed: installedIds.has(hit.project_id),
        inPack: false,
      });
      if (hits.length >= wanted) break;
    }
    apiOffset += batch.length;
    if (!batch.length || batch.length < pageSize) break;
  }

  const seen = new Set(hits.map((hit) => hit.id));
  const installedHits =
    startOffset === 0
      ? extras.items
          .filter((item) => item.type === type && !seen.has(item.id))
          .map((item) => ({
            id: item.id,
            slug: item.slug,
            title: item.title,
            description: `Instalado (${item.versionNumber || "neste launcher"})`,
            icon: "",
            downloads: 0,
            type,
            loader: item.loader || selected,
            installed: true,
            inPack: false,
          }))
      : [];

  return {
    hits: [...installedHits, ...hits],
    offset: apiOffset,
    hasMore: apiOffset < total && hits.length > 0,
    total,
    compat: {
      mcVersion,
      loader: selected,
      packLoader: "fabric",
      selectedLoader: selected,
      label: "Fabric 1.21.1",
    },
  };
}

async function installFile(projectId, type, compat) {
  if (!FOLDERS[type]) throw new Error("Tipo de extra inválido.");
  const project = await fetchJson(`${MODRINTH}/project/${projectId}`);
  const version = await pickVersion(projectId, type, compat);
  if (!version) {
    throw new Error(`Nenhuma versão compatível com ${loaderLabel(compat.loader)} ${compat.mcVersion}.`);
  }
  const file = version.files.find((item) => item.primary) || version.files[0];
  if (!file?.url) throw new Error("Esse projeto não tem arquivo para baixar.");

  const folder = extraFolder(type);
  const filename = safeFilename(file.filename);
  const dest = path.join(folder, filename);
  await downloadToFile(file.url, dest);
  if (!fs.existsSync(dest) || fs.statSync(dest).size < 32) {
    throw new Error(`O download de ${project.title} veio vazio.`);
  }

  const extras = readExtras();
  extras.items = extras.items.filter((item) => item.id !== projectId);
  extras.items.push({
    id: project.id || projectId,
    slug: project.slug,
    title: project.title,
    type,
    loader: compat.loader,
    filename,
    versionId: version.id,
    versionNumber: version.version_number,
    installedAt: new Date().toISOString(),
  });
  writeExtras(extras);
  return publicItem(extras.items.at(-1));
}

function shaderHelperName(loader) {
  return loader === "fabric" ? "Iris" : "Oculus";
}

async function ensureShaderMod(compat) {
  const helperId = compat.loader === "fabric" ? IRIS_ID : OCULUS_SLUG;
  const packIds = await packProjectIds();
  if (packIds.has(helperId) || packIds.has(IRIS_ID)) return null;
  const extras = readExtras();
  if (extras.items.some((item) => item.id === helperId || item.id === IRIS_ID || item.slug === helperId)) {
    return null;
  }
  const pattern = compat.loader === "fabric" ? /^iris[-_]/i : /^(oculus|iris)[-_]/i;
  const already = fs.readdirSync(extraFolder("mod")).some((name) => pattern.test(name));
  if (already) return null;
  return installFile(helperId, "mod", compat);
}

async function installExtra(projectId, type) {
  if (!projectId) throw new Error("Projeto inválido.");
  const compat = { mcVersion: "1.21.1", loader: "fabric", packLoader: "fabric" };
  if (type === "shader") {
    await ensureShaderMod(compat);
  }
  const installed = await installFile(projectId, type, compat);
  return { installed, extras: readExtras().items.map(publicItem) };
}

async function removeExtra(projectId) {
  const extras = readExtras();
  const item = extras.items.find((entry) => entry.id === projectId);
  if (!item) return { extras: extras.items.map(publicItem) };
  const dest = path.join(extraFolder(item.type), item.filename);
  if (fs.existsSync(dest)) fs.rmSync(dest, { force: true });
  extras.items = extras.items.filter((entry) => entry.id !== projectId);
  writeExtras(extras);
  return { extras: extras.items.map(publicItem) };
}

function listInstalledExtras() {
  return readExtras().items.map(publicItem);
}

module.exports = {
  searchExtras,
  installExtra,
  removeExtra,
  listInstalledExtras,
  packFolder,
  ensurePackFolders,
  packCompat,
  LOADERS,
  shaderHelperName,
};

const fs = require("fs");
const path = require("path");
const { minecraftRoot, extrasFile, extrasRoot } = require("./paths");
const { fetchJson, downloadToFile, readInstance } = require("./installer");

const MODRINTH = "https://api.modrinth.com/v2";
const IRIS_ID = "YL57xq9U";
const IRIS_VERSION_ID = "zsoi0dso";
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

function extrasVault(type) {
  const name = FOLDERS[type];
  if (!name) throw new Error("Tipo de extra inválido.");
  const folder = path.join(extrasRoot(), name);
  fs.mkdirSync(folder, { recursive: true });
  return folder;
}

function extraPath(type, filename, where = "game") {
  return path.join(where === "vault" ? extrasVault(type) : extraFolder(type), filename);
}

function copyIfNeeded(from, to) {
  if (!from || !to || !fs.existsSync(from)) return false;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  return true;
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

const CATEGORIES = {
  mod: [
    ["adventure", "Aventura"],
    ["decoration", "Decoração"],
    ["equipment", "Equipamento"],
    ["food", "Comida"],
    ["game-mechanics", "Mecânicas"],
    ["magic", "Magia"],
    ["mobs", "Mobs"],
    ["optimization", "Otimização"],
    ["social", "Social"],
    ["storage", "Armazenamento"],
    ["technology", "Tecnologia"],
    ["transportation", "Transporte"],
    ["utility", "Utilidade"],
    ["worldgen", "Mundo"],
  ],
  resourcepack: [
    ["combat", "Combate"],
    ["cursed", "Cursed"],
    ["decoration", "Decoração"],
    ["modded", "Modded"],
    ["realistic", "Realista"],
    ["simplistic", "Simples"],
    ["themed", "Temático"],
    ["tweaks", "Tweaks"],
    ["utility", "Utilidade"],
    ["vanilla-like", "Vanilla-like"],
  ],
  shader: [
    ["cartoon", "Cartoon"],
    ["cursed", "Cursed"],
    ["fantasy", "Fantasia"],
    ["realistic", "Realista"],
    ["vanilla-like", "Vanilla-like"],
  ],
};

const SORTS = ["relevance", "downloads", "follows", "updated", "newest"];

function facetsFor(type, { loader, mcVersion, category }) {
  const versions = [`versions:${mcVersion}`];
  if (mcVersion.startsWith("1.21")) versions.push("versions:1.21");
  const facets = [];
  if (type === "mod") {
    facets.push(["project_type:mod"], [`versions:${mcVersion}`], [`categories:${loader}`]);
  } else if (type === "resourcepack") {
    facets.push(["project_type:resourcepack"], versions);
  } else {
    facets.push(["project_type:shader"], ["categories:iris", "categories:optifine"]);
  }
  if (category) facets.push([`categories:${category}`]);
  return facets;
}

function isIrisProject(projectId) {
  const id = String(projectId || "").toLowerCase();
  return id === IRIS_ID.toLowerCase() || id === "iris";
}

function isPinnedIrisJar(name) {
  return /^iris[-_].*1\.8\.8/i.test(String(name || "")) && !/beta/i.test(String(name || ""));
}

function isCompatibleVersion(version, type, projectId) {
  if (isIrisProject(projectId) || isIrisProject(version.project_id)) {
    return version.id === IRIS_VERSION_ID;
  }
  const games = version.game_versions || [];
  const loaders = (version.loaders || []).map((item) => String(item).toLowerCase());
  if (type === "mod") return loaders.includes("fabric") && games.includes("1.21.1");
  if (type === "resourcepack") return games.includes("1.21.1") || games.includes("1.21");
  if (type === "shader") return loaders.includes("iris") || loaders.includes("optifine") || !loaders.length;
  return false;
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
  if (isIrisProject(projectId)) {
    return fetchJson(`${MODRINTH}/version/${IRIS_VERSION_ID}`);
  }
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

async function searchExtras({ type = "mod", query = "", offset = 0, category = "", sort = "" } = {}) {
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
  const index = SORTS.includes(sort) ? sort : query.trim() ? "relevance" : "downloads";
  const cat = String(category || "").trim();

  while (hits.length < wanted && apiOffset < startOffset + 400) {
    const params = new URLSearchParams({
      limit: String(pageSize),
      offset: String(apiOffset),
      index,
      facets: JSON.stringify(facetsFor(type, { loader: selected, mcVersion, category: cat })),
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
      categories: CATEGORIES[type] || [],
      sort: index,
      category: cat,
    },
  };
}

async function listExtraVersions(projectId, type = "mod") {
  if (!projectId) throw new Error("Projeto inválido.");
  const project = await fetchJson(`${MODRINTH}/project/${projectId}`);
  const versions = await fetchJson(`${MODRINTH}/project/${projectId}/version`);
  const extras = readExtras();
  const installed = extras.items.find((item) => item.id === projectId);
  return {
    project: {
      id: project.id,
      slug: project.slug,
      title: project.title,
      description: project.description || "",
      icon: project.icon_url,
      type,
    },
    installedVersionId: installed?.versionId || null,
    installedVersionNumber: installed?.versionNumber || null,
    versions: (versions || [])
      .filter((item) => item.files?.length)
      .map((item) => ({
        id: item.id,
        name: item.name,
        versionNumber: item.version_number,
        versionType: item.version_type,
        date: item.date_published,
        downloads: item.downloads || 0,
        gameVersions: item.game_versions || [],
        loaders: item.loaders || [],
        compatible: isCompatibleVersion(item, type, project.id),
        featured: Boolean(item.featured),
      })),
  };
}

function removeStoredFile(type, filename) {
  if (!filename) return;
  for (const where of ["vault", "game"]) {
    const dest = extraPath(type, filename, where);
    if (fs.existsSync(dest)) fs.rmSync(dest, { force: true });
  }
}

function parseOptions(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8").split(/\r?\n/);
}

function writeOptions(file, lines) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const body = lines.join("\n").replace(/\n+$/, "");
  fs.writeFileSync(file, body ? `${body}\n` : "");
}

function enableResourcePacks(filenames) {
  const file = path.join(minecraftRoot(), "options.txt");
  const lines = parseOptions(file);
  const wanted = filenames.map((name) => `file/${name}`);
  let list = ["vanilla", "fabric"];
  const currentLine = lines.find((line) => line.startsWith("resourcePacks:"));
  if (currentLine) {
    try {
      const parsed = JSON.parse(currentLine.slice("resourcePacks:".length));
      if (Array.isArray(parsed) && parsed.length) list = parsed;
    } catch {
      // mantém o padrão
    }
  }
  const keep = list.filter((id) => !String(id).startsWith("file/"));
  const folder = extraFolder("resourcepack");
  const onDisk = new Set(fs.existsSync(folder) ? fs.readdirSync(folder) : []);
  const leftover = list.filter((id) => {
    if (!String(id).startsWith("file/")) return false;
    const name = String(id).slice("file/".length);
    return onDisk.has(name) && !wanted.includes(id);
  });
  const next = [...keep, ...leftover, ...wanted.filter((id) => !keep.includes(id) && !leftover.includes(id))];
  const encoded = `resourcePacks:${JSON.stringify(next)}`;
  const index = lines.findIndex((line) => line.startsWith("resourcePacks:"));
  if (index >= 0) lines[index] = encoded;
  else lines.push(encoded);
  if (!lines.some((line) => line.startsWith("incompatibleResourcePacks:"))) {
    lines.push("incompatibleResourcePacks:[]");
  }
  writeOptions(file, lines);
}

function enableShader(filename) {
  const bodies = [];
  if (filename) {
    bodies.push(`enableShaders=true`);
    bodies.push(`disableUpdateMessage=false`);
    bodies.push(`maxShadowRenderDistance=32`);
    bodies.push(`shaderPack=${filename}`);
  }
  const files = [
    path.join(minecraftRoot(), "iris.properties"),
    path.join(minecraftRoot(), "config", "iris.properties"),
  ];
  for (const file of files) {
    if (!filename && !fs.existsSync(file)) continue;
    if (!filename) {
      const lines = parseOptions(file).map((line) => {
        if (line.startsWith("shaderPack=")) return "shaderPack=";
        if (line.startsWith("enableShaders=")) return "enableShaders=false";
        return line;
      });
      writeOptions(file, lines);
      continue;
    }
    if (fs.existsSync(file)) {
      const lines = parseOptions(file);
      const set = {
        enableShaders: false,
        shaderPack: false,
      };
      const next = lines.map((line) => {
        if (line.startsWith("enableShaders=")) {
          set.enableShaders = true;
          return "enableShaders=true";
        }
        if (line.startsWith("shaderPack=")) {
          set.shaderPack = true;
          return `shaderPack=${filename}`;
        }
        return line;
      });
      if (!set.enableShaders) next.push("enableShaders=true");
      if (!set.shaderPack) next.push(`shaderPack=${filename}`);
      writeOptions(file, next);
    } else {
      writeOptions(file, bodies);
    }
  }
}

function migrateExtrasToVault() {
  const extras = readExtras();
  for (const item of extras.items) {
    const vault = extraPath(item.type, item.filename, "vault");
    const game = extraPath(item.type, item.filename, "game");
    if (!fs.existsSync(vault) && fs.existsSync(game)) copyIfNeeded(game, vault);
  }
}

function syncExtrasToGame() {
  ensurePackFolders();
  migrateExtrasToVault();
  const extras = readExtras();
  const iris = extras.items.find((item) => isIrisProject(item.id) || isIrisProject(item.slug));
  removeLooseIris(iris?.versionId === IRIS_VERSION_ID ? iris.filename : "");
  for (const item of extras.items) {
    const vault = extraPath(item.type, item.filename, "vault");
    const game = extraPath(item.type, item.filename, "game");
    if (fs.existsSync(vault)) copyIfNeeded(vault, game);
  }
  const packs = extras.items.filter((item) => item.type === "resourcepack").map((item) => item.filename);
  enableResourcePacks(packs);
  const shaders = extras.items
    .filter((item) => item.type === "shader")
    .sort((a, b) => String(b.installedAt || "").localeCompare(String(a.installedAt || "")));
  enableShader(shaders[0]?.filename || "");
  return extras.items.map(publicItem);
}

async function applyExtras() {
  const extras = readExtras();
  const needsIris = extras.items.some(
    (item) => item.type === "shader" || isIrisProject(item.id) || isIrisProject(item.slug)
  );
  const strayIris = [extraFolder("mod"), extrasVault("mod")].some(
    (folder) =>
      fs.existsSync(folder) &&
      fs.readdirSync(folder).some((name) => /^iris[-_]/i.test(name) && !isPinnedIrisJar(name))
  );
  if (needsIris) {
    await ensureShaderMod({ mcVersion: "1.21.1", loader: "fabric", packLoader: "fabric" });
  } else if (strayIris) {
    removeLooseIris();
  }
  return syncExtrasToGame();
}

async function installFile(projectId, type, compat, versionId) {
  if (!FOLDERS[type]) throw new Error("Tipo de extra inválido.");
  const project = await fetchJson(`${MODRINTH}/project/${projectId}`);
  let version = null;
  if (isIrisProject(projectId) || isIrisProject(project.id) || isIrisProject(project.slug)) {
    version = await fetchJson(`${MODRINTH}/version/${IRIS_VERSION_ID}`);
  } else if (versionId) {
    version = await fetchJson(`${MODRINTH}/version/${versionId}`);
    if (!isCompatibleVersion(version, type, project.id)) {
      throw new Error("Essa versão não é Fabric 1.21.1. Escolha uma compatível para não quebrar o pack.");
    }
  } else {
    version = await pickVersion(projectId, type, compat);
  }
  if (!version) {
    throw new Error(`Nenhuma versão compatível com ${loaderLabel(compat.loader)} ${compat.mcVersion}.`);
  }
  const file = version.files.find((item) => item.primary) || version.files[0];
  if (!file?.url) throw new Error("Esse projeto não tem arquivo para baixar.");

  const filename = safeFilename(file.filename);
  const dest = extraPath(type, filename, "vault");
  const extras = readExtras();
  const previous = extras.items.find((item) => item.id === projectId);
  if (previous?.filename && previous.filename !== filename) {
    removeStoredFile(previous.type, previous.filename);
  }
  await downloadToFile(file.url, dest);
  if (!fs.existsSync(dest) || fs.statSync(dest).size < 32) {
    throw new Error(`O download de ${project.title} veio vazio.`);
  }

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
  syncExtrasToGame();
  return publicItem(extras.items.at(-1));
}

function shaderHelperName(loader) {
  return loader === "fabric" ? "Iris" : "Oculus";
}

function removeLooseIris(keepFilename = "") {
  for (const folder of [extraFolder("mod"), extrasVault("mod")]) {
    if (!fs.existsSync(folder)) continue;
    for (const name of fs.readdirSync(folder)) {
      if (!/^iris[-_]/i.test(name)) continue;
      if (keepFilename && (name === keepFilename || isPinnedIrisJar(name))) continue;
      fs.rmSync(path.join(folder, name), { force: true });
    }
  }
}

async function ensureShaderMod(compat) {
  const helperId = IRIS_ID;
  const packIds = await packProjectIds();
  if (packIds.has(helperId) || packIds.has(IRIS_ID)) return null;
  const extras = readExtras();
  const existing = extras.items.find(
    (item) => item.id === helperId || item.id === IRIS_ID || item.slug === "iris"
  );
  if (existing?.versionId === IRIS_VERSION_ID) {
    const vault = extraPath("mod", existing.filename, "vault");
    if (fs.existsSync(vault)) {
      removeLooseIris(existing.filename);
      return null;
    }
  }
  removeLooseIris();
  return installFile(helperId, "mod", compat, IRIS_VERSION_ID);
}

async function installExtra(projectId, type, versionId) {
  if (!projectId) throw new Error("Projeto inválido.");
  const compat = { mcVersion: "1.21.1", loader: "fabric", packLoader: "fabric" };
  if (type === "shader" || isIrisProject(projectId)) {
    const iris = await ensureShaderMod(compat);
    if (isIrisProject(projectId)) {
      return { installed: iris || readExtras().items.find((item) => isIrisProject(item.id)), extras: readExtras().items.map(publicItem) };
    }
  }
  const installed = await installFile(projectId, type, compat, versionId);
  return { installed, extras: readExtras().items.map(publicItem) };
}

async function removeExtra(projectId) {
  const extras = readExtras();
  const item = extras.items.find((entry) => entry.id === projectId);
  if (!item) return { extras: extras.items.map(publicItem) };
  removeStoredFile(item.type, item.filename);
  extras.items = extras.items.filter((entry) => entry.id !== projectId);
  writeExtras(extras);
  syncExtrasToGame();
  return { extras: extras.items.map(publicItem) };
}

function listInstalledExtras() {
  return readExtras().items.map(publicItem);
}

module.exports = {
  searchExtras,
  listExtraVersions,
  installExtra,
  applyExtras,
  removeExtra,
  listInstalledExtras,
  packFolder,
  ensurePackFolders,
  packCompat,
  LOADERS,
  CATEGORIES,
  shaderHelperName,
};

const fs = require("fs");
const path = require("path");
const { minecraftRoot, extrasFile } = require("./paths");
const { fetchJson, downloadToFile, readInstance } = require("./installer");

const MODRINTH = "https://api.modrinth.com/v2";
const MC_VERSION = "1.21.1";
const IRIS_ID = "YL57xq9U";
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
  };
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

function facetsFor(type) {
  if (type === "mod") {
    return [
      ["project_type:mod"],
      [`versions:${MC_VERSION}`],
      ["categories:fabric"],
      ["server_side:unsupported"],
    ];
  }
  if (type === "resourcepack") {
    return [["project_type:resourcepack"], [`versions:${MC_VERSION}`, "versions:1.21"]];
  }
  return [["project_type:shader"], ["categories:iris"]];
}

async function pickVersion(projectId, type) {
  if (type === "mod") {
    const versions = await fetchJson(
      `${MODRINTH}/project/${projectId}/version?game_versions=${encodeURIComponent(
        JSON.stringify([MC_VERSION])
      )}&loaders=${encodeURIComponent(JSON.stringify(["fabric"]))}`
    );
    return versions.find((item) => item.version_type === "release") || versions[0] || null;
  }
  if (type === "resourcepack") {
    let versions = await fetchJson(
      `${MODRINTH}/project/${projectId}/version?game_versions=${encodeURIComponent(
        JSON.stringify([MC_VERSION])
      )}`
    );
    if (!versions.length) {
      versions = await fetchJson(
        `${MODRINTH}/project/${projectId}/version?game_versions=${encodeURIComponent(JSON.stringify(["1.21"]))}`
      );
    }
    return versions.find((item) => item.version_type === "release") || versions[0] || null;
  }
  let versions = await fetchJson(
    `${MODRINTH}/project/${projectId}/version?game_versions=${encodeURIComponent(
      JSON.stringify([MC_VERSION])
    )}&loaders=${encodeURIComponent(JSON.stringify(["iris"]))}`
  );
  if (!versions.length) {
    versions = await fetchJson(
      `${MODRINTH}/project/${projectId}/version?loaders=${encodeURIComponent(JSON.stringify(["iris"]))}`
    );
  }
  return versions.find((item) => item.version_type === "release") || versions[0] || null;
}

async function searchExtras({ type = "mod", query = "", offset = 0 }) {
  const packIds = await packProjectIds();
  const extras = readExtras();
  const installedIds = new Set(extras.items.map((item) => item.id));
  const params = new URLSearchParams({
    limit: "20",
    offset: String(offset),
    index: query.trim() ? "relevance" : "downloads",
    facets: JSON.stringify(facetsFor(type)),
  });
  if (query.trim()) params.set("query", query.trim());

  const data = await fetchJson(`${MODRINTH}/search?${params.toString()}`);
  const hits = (data.hits || [])
    .filter((hit) => !packIds.has(hit.project_id))
    .filter((hit) => hit.client_side !== "unsupported")
    .filter((hit) => type !== "mod" || hit.server_side === "unsupported")
    .map((hit) => ({
      id: hit.project_id,
      slug: hit.slug,
      title: hit.title,
      description: hit.description,
      icon: hit.icon_url,
      downloads: hit.downloads,
      type,
      installed: installedIds.has(hit.project_id),
      inPack: false,
    }));

  return {
    hits,
    offset,
    total: data.total_hits || hits.length,
    installed: extras.items.map(publicItem),
  };
}

async function installFile(projectId, type) {
  const project = await fetchJson(`${MODRINTH}/project/${projectId}`);
  const version = await pickVersion(projectId, type);
  if (!version) {
    throw new Error(`Nenhuma versão compatível com o Sitrus (1.21.1 / Fabric).`);
  }
  const file = version.files.find((item) => item.primary) || version.files[0];
  if (!file) throw new Error("Esse projeto não tem arquivo para baixar.");

  const folder = path.join(minecraftRoot(), FOLDERS[type]);
  fs.mkdirSync(folder, { recursive: true });
  const dest = path.join(folder, file.filename);
  await downloadToFile(file.url, dest);

  const extras = readExtras();
  extras.items = extras.items.filter((item) => item.id !== projectId);
  extras.items.push({
    id: projectId,
    slug: project.slug,
    title: project.title,
    type,
    filename: file.filename,
    versionId: version.id,
    versionNumber: version.version_number,
    installedAt: new Date().toISOString(),
  });
  writeExtras(extras);
  return publicItem(extras.items.at(-1));
}

async function ensureIris() {
  const packIds = await packProjectIds();
  if (packIds.has(IRIS_ID)) return null;
  const extras = readExtras();
  if (extras.items.some((item) => item.id === IRIS_ID)) return null;
  return installFile(IRIS_ID, "mod");
}

async function installExtra(projectId, type) {
  if (type === "shader") {
    await ensureIris();
  }
  const installed = await installFile(projectId, type);
  return { installed, extras: readExtras().items.map(publicItem) };
}

async function removeExtra(projectId) {
  const extras = readExtras();
  const item = extras.items.find((entry) => entry.id === projectId);
  if (!item) return { extras: extras.items.map(publicItem) };
  const dest = path.join(minecraftRoot(), FOLDERS[item.type], item.filename);
  if (fs.existsSync(dest)) fs.rmSync(dest, { force: true });
  extras.items = extras.items.filter((entry) => entry.id !== projectId);
  writeExtras(extras);
  return { extras: extras.items.map(publicItem) };
}

function listInstalledExtras() {
  return readExtras().items.map(publicItem);
}

module.exports = { searchExtras, installExtra, removeExtra, listInstalledExtras };

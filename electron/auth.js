const fs = require("fs");
const crypto = require("crypto");
const { Auth } = require("msmc");
const { accountFile } = require("./paths");

function readAccount() {
  try {
    return JSON.parse(fs.readFileSync(accountFile(), "utf8"));
  } catch {
    return null;
  }
}

function writeAccount(account) {
  fs.mkdirSync(require("path").dirname(accountFile()), { recursive: true });
  fs.writeFileSync(accountFile(), JSON.stringify(account, null, 2));
}

function clearAccount() {
  if (fs.existsSync(accountFile())) fs.unlinkSync(accountFile());
}

function offlineUuid(name) {
  const md5Bytes = crypto.createHash("md5").update(`OfflinePlayer:${name}`, "utf8").digest();
  md5Bytes[6] = (md5Bytes[6] & 0x0f) | 0x30;
  md5Bytes[8] = (md5Bytes[8] & 0x3f) | 0x80;
  const hex = md5Bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function publicAccount(account) {
  if (!account) return null;
  const uuid = String(account.uuid || "").replaceAll("-", "");
  const name = account.name;
  return {
    type: account.type,
    name,
    uuid,
    avatar: uuid
      ? `https://mc-heads.net/avatar/${uuid}/64`
      : name
        ? `https://mc-heads.net/avatar/${encodeURIComponent(name)}/64`
        : null,
  };
}

async function fetchAvatarData(uuid, name) {
  const id = String(uuid || "").replaceAll("-", "");
  const nick = encodeURIComponent(name || "");
  const urls = [
    id ? `https://mc-heads.net/avatar/${id}/64` : null,
    nick ? `https://mc-heads.net/avatar/${nick}/64` : null,
    id ? `https://minotar.net/helm/${id}/64` : null,
    nick ? `https://minotar.net/helm/${nick}/64` : null,
  ].filter(Boolean);

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "SitrusLauncher" },
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 40) continue;
      return `data:image/png;base64,${buf.toString("base64")}`;
    } catch {
      // tenta o próximo CDN
    }
  }
  return null;
}

async function attachAvatar(account) {
  const pub = publicAccount(account);
  if (!pub) return null;
  const data = await fetchAvatarData(pub.uuid, pub.name);
  if (data) pub.avatar = data;
  return pub;
}

function toMclc(account) {
  if (!account) throw new Error("Nenhuma conta salva.");
  if (account.mclc) return account.mclc;
  return {
    access_token: account.accessToken || "0",
    client_token: account.clientToken || "0",
    uuid: String(account.uuid || "").replaceAll("-", ""),
    name: account.name,
    user_properties: "{}",
    meta: {
      type: account.type === "microsoft" ? "msa" : "mojang",
      demo: false,
    },
  };
}

function loginOffline(name) {
  const trimmed = String(name || "").trim();
  if (!/^[A-Za-z0-9_]{3,16}$/.test(trimmed)) {
    throw new Error("Nick inválido. Use 3 a 16 caracteres (letras, números ou _).");
  }
  const account = {
    type: "offline",
    name: trimmed,
    uuid: offlineUuid(trimmed),
    accessToken: "0",
    clientToken: crypto.randomUUID(),
  };
  writeAccount(account);
  return attachAvatar(account);
}

async function loginMicrosoft() {
  const authManager = new Auth("select_account");
  const xboxManager = await authManager.launch("electron");
  const token = await xboxManager.getMinecraft();
  const mclc = token.mclc(true);
  const account = {
    type: "microsoft",
    name: mclc.name,
    uuid: mclc.uuid,
    accessToken: mclc.access_token,
    clientToken: mclc.client_token,
    xbox: xboxManager.save(),
    mclc,
  };
  writeAccount(account);
  return attachAvatar(account);
}

async function restoreAccount() {
  const saved = readAccount();
  if (!saved) return null;
  if (saved.type !== "microsoft" || !saved.xbox) return attachAvatar(saved);

  try {
    const authManager = new Auth("select_account");
    const xboxManager = await authManager.refresh(saved.xbox);
    const token = await xboxManager.getMinecraft();
    const mclc = token.mclc(true);
    const account = {
      type: "microsoft",
      name: mclc.name,
      uuid: mclc.uuid,
      accessToken: mclc.access_token,
      clientToken: mclc.client_token,
      xbox: xboxManager.save(),
      mclc,
    };
    writeAccount(account);
    return attachAvatar(account);
  } catch {
    clearAccount();
    return null;
  }
}

module.exports = {
  readAccount,
  publicAccount,
  toMclc,
  loginOffline,
  loginMicrosoft,
  restoreAccount,
  clearAccount,
};

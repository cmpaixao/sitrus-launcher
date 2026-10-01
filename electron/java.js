const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { runtimeRoot } = require("./paths");

const UA = "SitrusLauncher/1.0.0 (https://modrinth.com/modpack/sitrus-cobblemon)";

function parseJavaVersion(text) {
  const match = text.match(/version "(\d+)(?:\.(\d+))?/);
  if (!match) return 0;
  const major = Number(match[1]);
  return major === 1 ? Number(match[2] || 0) : major;
}

function javaVersion(javaPath) {
  return new Promise((resolve) => {
    const child = spawn(javaPath, ["-version"], { windowsHide: true });
    let out = "";
    child.stderr.on("data", (d) => (out += d.toString()));
    child.stdout.on("data", (d) => (out += d.toString()));
    child.on("error", () => resolve(0));
    child.on("close", () => resolve(parseJavaVersion(out)));
  });
}

async function findJava21(preferred) {
  const bundled = path.join(runtimeRoot(), "jdk-21", "bin", "java.exe");
  const candidates = [
    preferred,
    bundled,
    process.env.JAVA_HOME && path.join(process.env.JAVA_HOME, "bin", "java.exe"),
    "java",
  ].filter(Boolean);

  const programFiles = [
    process.env["ProgramFiles"],
    process.env["ProgramFiles(x86)"],
    process.env.LOCALAPPDATA,
  ].filter(Boolean);

  for (const root of programFiles) {
    for (const vendor of ["Eclipse Adoptium", "Java", "Microsoft", "Zulu", "Temurin"]) {
      const vendorDir = path.join(root, vendor);
      if (!fs.existsSync(vendorDir)) continue;
      for (const name of fs.readdirSync(vendorDir)) {
        candidates.push(path.join(vendorDir, name, "bin", "java.exe"));
      }
    }
  }

  for (const candidate of [...new Set(candidates)]) {
    if (candidate !== "java" && !fs.existsSync(candidate)) continue;
    const version = await javaVersion(candidate);
    if (version >= 21) return candidate;
  }
  return null;
}

async function downloadJava(onProgress) {
  const url =
    "https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jre/hotspot/normal/eclipse?project=jdk";
  const zipPath = path.join(runtimeRoot(), "jdk-21.zip");
  const extractTo = runtimeRoot();
  fs.mkdirSync(extractTo, { recursive: true });

  onProgress?.({ phase: "java", message: "Baixando Java 21...", percent: 5 });
  const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow" });
  if (!res.ok) throw new Error(`Falha ao baixar Java 21 (${res.status})`);
  const total = Number(res.headers.get("content-length")) || 0;
  const file = fs.createWriteStream(zipPath);
  const reader = res.body.getReader();
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    file.write(Buffer.from(value));
    if (total) {
      onProgress?.({
        phase: "java",
        message: "Baixando Java 21...",
        percent: Math.round((received / total) * 70),
      });
    }
  }
  await new Promise((resolve, reject) => {
    file.end(() => resolve());
    file.on("error", reject);
  });

  onProgress?.({ phase: "java", message: "Extraindo Java 21...", percent: 80 });
  const extractZip = require("extract-zip");
  const temp = path.join(extractTo, "jdk-temp");
  if (fs.existsSync(temp)) fs.rmSync(temp, { recursive: true, force: true });
  await extractZip(zipPath, { dir: temp });

  const entries = fs.readdirSync(temp);
  const jdkFolder = path.join(temp, entries[0] || "");
  const target = path.join(extractTo, "jdk-21");
  if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
  fs.renameSync(jdkFolder, target);
  fs.rmSync(temp, { recursive: true, force: true });
  fs.rmSync(zipPath, { force: true });

  const javaPath = path.join(target, "bin", "java.exe");
  if (!fs.existsSync(javaPath)) throw new Error("Java 21 extraído, mas java.exe não foi encontrado.");
  onProgress?.({ phase: "java", message: "Java 21 pronto.", percent: 100 });
  return javaPath;
}

async function ensureJava(preferred, onProgress) {
  const existing = await findJava21(preferred);
  if (existing) return existing;
  onProgress?.({ phase: "java", message: "Java 21 não encontrado. Vou baixar um runtime...", percent: 0 });
  return downloadJava(onProgress);
}

module.exports = { ensureJava, findJava21 };

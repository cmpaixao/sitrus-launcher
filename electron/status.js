async function pingServer(address, port = 25565) {
  const host = String(address || "").trim() || "sitruscobblemon.com";
  const target = port && Number(port) !== 25565 ? `${host}:${port}` : host;
  try {
    const res = await fetch(`https://api.mcstatus.io/v2/status/java/${encodeURIComponent(target)}`, {
      headers: { "User-Agent": "SitrusLauncher" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { online: false, host, players: 0, max: 0 };
    const data = await res.json();
    return {
      online: Boolean(data.online),
      host,
      motd: data.motd?.clean || "",
      players: Number(data.players?.online) || 0,
      max: Number(data.players?.max) || 0,
      version: data.version?.name_clean || data.version?.name_raw || "",
    };
  } catch {
    return { online: false, host, players: 0, max: 0 };
  }
}

module.exports = { pingServer };

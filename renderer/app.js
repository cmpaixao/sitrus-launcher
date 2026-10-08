const ui = {
  minBtn: document.getElementById("minBtn"),
  maxBtn: document.getElementById("maxBtn"),
  closeBtn: document.getElementById("closeBtn"),
  discordBtn: document.getElementById("discordBtn"),
  wikiBtn: document.getElementById("wikiBtn"),
  storeBtn: document.getElementById("storeBtn"),
  modrinthBtn: document.getElementById("modrinthBtn"),
  msBtn: document.getElementById("msBtn"),
  offlineBtn: document.getElementById("offlineBtn"),
  offlineNick: document.getElementById("offlineNick"),
  logoutBtn: document.getElementById("logoutBtn"),
  loggedOut: document.getElementById("loggedOut"),
  loggedIn: document.getElementById("loggedIn"),
  avatar: document.getElementById("avatar"),
  playerName: document.getElementById("playerName"),
  accountType: document.getElementById("accountType"),
  ram: document.getElementById("ram"),
  ramValue: document.getElementById("ramValue"),
  closeOnPlay: document.getElementById("closeOnPlay"),
  serverAddress: document.getElementById("serverAddress"),
  playBtn: document.getElementById("playBtn"),
  bar: document.getElementById("bar"),
  progress: document.getElementById("progress"),
  status: document.getElementById("status"),
  packVersion: document.getElementById("packVersion"),
  updateHint: document.getElementById("updateHint"),
  homeTabBtn: document.getElementById("homeTabBtn"),
  extrasTabBtn: document.getElementById("extrasTabBtn"),
  configTabBtn: document.getElementById("configTabBtn"),
  homeTab: document.getElementById("homeTab"),
  extrasTab: document.getElementById("extrasTab"),
  configTab: document.getElementById("configTab"),
  extrasSearch: document.getElementById("extrasSearch"),
  extrasList: document.getElementById("extrasList"),
  extrasHint: document.getElementById("extrasHint"),
  layout: document.getElementById("layout"),
  launcherUpdate: document.getElementById("launcherUpdate"),
  launcherUpdateText: document.getElementById("launcherUpdateText"),
  restartUpdateBtn: document.getElementById("restartUpdateBtn"),
  launcherVersion: document.getElementById("launcherVersion"),
  openPackFolderBtn: document.getElementById("openPackFolderBtn"),
  openExtrasFolderBtn: document.getElementById("openExtrasFolderBtn"),
  openPackFolderConfigBtn: document.getElementById("openPackFolderConfigBtn"),
  shareLogBtn: document.getElementById("shareLogBtn"),
  shareLogHint: document.getElementById("shareLogHint"),
  shareLogResult: document.getElementById("shareLogResult"),
  extrasSort: document.getElementById("extrasSort"),
  extrasCategories: document.getElementById("extrasCategories"),
  accountChip: document.getElementById("accountChip"),
  chipAvatar: document.getElementById("chipAvatar"),
  chipName: document.getElementById("chipName"),
  chipType: document.getElementById("chipType"),
  serverStatus: document.getElementById("serverStatus"),
  serverDot: document.getElementById("serverDot"),
  serverLabel: document.getElementById("serverLabel"),
  serverPlayers: document.getElementById("serverPlayers"),
};

let state = {
  pack: null,
  settings: null,
  account: null,
  busy: false,
  extrasType: "mod",
  extrasQuery: "",
  extrasLoaded: false,
  extrasOffset: 0,
  extrasHasMore: false,
  extrasHits: [],
  extrasCategory: "",
  extrasSort: "downloads",
  extrasOpenId: "",
  extrasVersions: {},
  lastTab: "home",
};

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function setStatus(text, percent, isError = false) {
  ui.status.textContent = text;
  ui.status.classList.toggle("is-error", Boolean(isError));
  if (typeof percent === "number") {
    const value = Math.max(0, Math.min(100, percent));
    ui.bar.style.width = `${value}%`;
    ui.progress?.setAttribute("aria-valuenow", String(Math.round(value)));
    const showBar = state.busy || (value > 0 && value < 100);
    if (ui.progress) ui.progress.hidden = !showBar;
  } else if (!state.busy && ui.progress) {
    ui.progress.hidden = true;
  }
}

function renderAccount() {
  const account = state.account;
  ui.loggedOut.hidden = Boolean(account);
  ui.loggedIn.hidden = !account;
  ui.playBtn.disabled = !account || state.busy;
  ui.playBtn.textContent = state.busy ? "PREPARANDO..." : account ? "JOGAR" : "ENTRAR";
  ui.playBtn.title = !account
    ? "Entre com uma conta para jogar"
    : state.busy
      ? "O launcher está preparando o jogo"
      : "Iniciar o Sitrus Cobblemon";
  ui.playBtn.setAttribute("aria-busy", state.busy ? "true" : "false");
  if (ui.logoutBtn) ui.logoutBtn.hidden = !account;
  if (ui.accountChip) ui.accountChip.hidden = !account;
  if (!account) return;
  ui.playerName.textContent = account.name;
  ui.accountType.textContent = account.type === "microsoft" ? "Conta Microsoft" : "Offline";
  if (ui.chipName) ui.chipName.textContent = account.name;
  if (ui.chipType) ui.chipType.textContent = account.type === "microsoft" ? "Conta Microsoft" : "Offline";
  setAvatar(account);
}

function avatarUrls(account) {
  const uuid = String(account?.uuid || "").replaceAll("-", "");
  const name = encodeURIComponent(account?.name || "");
  return [
    account?.avatar,
    uuid ? `https://mc-heads.net/avatar/${uuid}/64` : null,
    name ? `https://mc-heads.net/avatar/${name}/64` : null,
    uuid ? `https://crafatar.com/avatars/${uuid}?size=64&overlay` : null,
    name ? `https://minotar.net/helm/${name}/64` : null,
    "../assets/icon.png",
  ].filter((url, index, list) => url && list.indexOf(url) === index);
}

function bindAvatar(img, account) {
  if (!img || !account) return;
  const urls = avatarUrls(account);
  let index = 0;
  img.onerror = () => {
    index += 1;
    if (index < urls.length) img.src = urls[index];
  };
  img.src = urls[0];
}

function setAvatar(account) {
  bindAvatar(ui.avatar, account);
  bindAvatar(ui.chipAvatar, account);
}

function bindSettings() {
  const settings = state.settings;
  ui.ram.value = settings.ramGb;
  ui.ramValue.textContent = settings.ramGb;
  ui.closeOnPlay.checked = settings.closeOnPlay;
  ui.serverAddress.value = settings.serverAddress || "";
}

async function persistSettings() {
  state.settings = await window.sitrus.saveSettings({
    ramGb: Number(ui.ram.value),
    closeOnPlay: ui.closeOnPlay.checked,
    checkUpdatesOnPlay: true,
    serverAddress: ui.serverAddress.value.trim(),
    lastTab: state.lastTab || "home",
  });
}

function initSlider() {
  const slider = document.getElementById("slider");
  if (!slider) return;
  const slides = [...slider.querySelectorAll(".slide")];
  const dots = [...slider.querySelectorAll(".slider-dot")];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let index = 0;
  let timer = null;

  function go(next) {
    index = (next + slides.length) % slides.length;
    slides.forEach((slide, i) => slide.classList.toggle("is-active", i === index));
    dots.forEach((dot, i) => {
      const selected = i === index;
      dot.classList.toggle("is-active", selected);
      dot.setAttribute("aria-selected", selected ? "true" : "false");
    });
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function start() {
    stop();
    if (reduceMotion || slides.length < 2) return;
    timer = setInterval(() => go(index + 1), 4500);
  }

  slider.querySelector(".prev")?.addEventListener("click", () => {
    go(index - 1);
    start();
  });
  slider.querySelector(".next")?.addEventListener("click", () => {
    go(index + 1);
    start();
  });
  dots.forEach((dot, i) => {
    dot.addEventListener("click", () => {
      go(i);
      start();
    });
  });
  slider.addEventListener("mouseenter", stop);
  slider.addEventListener("mouseleave", start);
  slider.addEventListener("focusin", stop);
  slider.addEventListener("focusout", (event) => {
    if (!slider.contains(event.relatedTarget)) start();
  });
  go(0);
  start();
}

initSlider();

ui.minBtn.onclick = () => window.sitrus.minimize();
ui.maxBtn.onclick = async () => {
  const maximized = await window.sitrus.maximize();
  ui.maxBtn.textContent = maximized ? "❐" : "□";
  ui.maxBtn.title = maximized ? "Restaurar" : "Maximizar";
  ui.maxBtn.setAttribute("aria-label", maximized ? "Restaurar janela" : "Maximizar");
};
ui.closeBtn.onclick = () => window.sitrus.close();
ui.ram.oninput = () => {
  ui.ramValue.textContent = ui.ram.value;
  ui.ram.setAttribute("aria-valuenow", ui.ram.value);
  ui.ram.setAttribute("aria-valuetext", `${ui.ram.value} gigabytes`);
};
ui.ram.onchange = persistSettings;
ui.closeOnPlay.onchange = persistSettings;
ui.serverAddress.onchange = async () => {
  await persistSettings();
  refreshServer();
};

function showTab(tab) {
  const tabs = [
    { id: "home", button: ui.homeTabBtn, panel: ui.homeTab },
    { id: "extras", button: ui.extrasTabBtn, panel: ui.extrasTab },
    { id: "config", button: ui.configTabBtn, panel: ui.configTab },
  ];
  state.lastTab = tab;
  for (const item of tabs) {
    const selected = item.id === tab;
    item.panel.hidden = !selected;
    item.button.classList.toggle("active", selected);
    item.button.setAttribute("aria-selected", selected ? "true" : "false");
    item.button.tabIndex = selected ? 0 : -1;
  }
  ui.layout.classList.toggle("full-panel", tab === "extras");
  persistSettings();
  if (tab === "extras") loadExtras();
}

ui.homeTabBtn.onclick = () => showTab("home");
ui.extrasTabBtn.onclick = () => showTab("extras");
ui.configTabBtn.onclick = () => showTab("config");

document.querySelector(".tabs").addEventListener("keydown", (event) => {
  const order = ["home", "extras", "config"];
  const current = order.indexOf(state.lastTab || "home");
  if (event.key === "ArrowRight") {
    event.preventDefault();
    showTab(order[(current + 1) % order.length]);
    document.querySelector(".tab.active")?.focus();
  }
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    showTab(order[(current + order.length - 1) % order.length]);
    document.querySelector(".tab.active")?.focus();
  }
});

ui.discordBtn.onclick = () => {
  window.sitrus.openExternal(state.pack?.discord || "https://discord.gg/wbavFswmkr");
};
ui.wikiBtn.onclick = () => {
  window.sitrus.openExternal(state.pack?.wiki || "https://wiki-sitruscobblemon.com.br/");
};
ui.storeBtn.onclick = () => {
  window.sitrus.openExternal(state.pack?.store || "https://sitruscobblemon.craftingstore.net/");
};
ui.modrinthBtn.onclick = () => {
  window.sitrus.openExternal("https://modrinth.com/modpack/sitrus-cobblemon");
};

ui.msBtn.onclick = async () => {
  try {
    setStatus("Abrindo login da Microsoft...");
    state.account = await window.sitrus.loginMicrosoft();
    renderAccount();
    setStatus(`Logado como ${state.account.name}.`);
  } catch (error) {
    setStatus(error.message || "Falha no login Microsoft.", 0, true);
  }
};

ui.offlineBtn.onclick = async () => {
  try {
    state.account = await window.sitrus.loginOffline(ui.offlineNick.value);
    renderAccount();
    setStatus(`Pronto, ${state.account.name}.`);
  } catch (error) {
    setStatus(error.message || "Nick inválido.", 0, true);
  }
};

ui.offlineNick.addEventListener("input", () => {
  const value = ui.offlineNick.value.trim();
  const valid = !value || /^[A-Za-z0-9_]{3,16}$/.test(value);
  ui.offlineNick.setAttribute("aria-invalid", valid ? "false" : "true");
  ui.offlineBtn.disabled = !/^[A-Za-z0-9_]{3,16}$/.test(value);
});
ui.offlineNick.addEventListener("keydown", (event) => {
  if (event.key === "Enter") ui.offlineBtn.click();
});
ui.offlineBtn.disabled = true;

window.addEventListener("keydown", (event) => {
  const typing = event.target instanceof Element && event.target.matches("input, textarea");
  if (typing) return;
  if (event.key === "1") showTab("home");
  if (event.key === "2") showTab("extras");
  if (event.key === "3") showTab("config");
});

ui.logoutBtn.onclick = async () => {
  state.account = await window.sitrus.logout();
  renderAccount();
  setStatus("Conta desconectada. Entre de novo na aba Jogar.");
  showTab("home");
};

ui.playBtn.onclick = async () => {
  if (state.busy) return;
  state.busy = true;
  renderAccount();
  await persistSettings();
  setStatus("Buscando atualização e preparando o Sitrus...", 4);
  const result = await window.sitrus.play();
  if (!result.ok) {
    state.busy = false;
    renderAccount();
    setStatus(result.message || "Não deu pra abrir o jogo.", 0, true);
  }
};

function extrasHint(total) {
  const count = typeof total === "number" ? ` ${total} resultados.` : "";
  if (state.extrasType === "mod") {
    return `Mods Fabric 1.21.1. Abra Versões para ver todas as builds do Modrinth.${count}`;
  }
  if (state.extrasType === "resourcepack") {
    return `Texturas para Minecraft 1.21.1. Ative no jogo em Opções > Resource Packs.${count}`;
  }
  return `Shaders compatíveis com Iris. Ative no menu do shader no jogo.${count}`;
}

function formatCount(value) {
  const num = Number(value) || 0;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(num);
}

function extraTags(item) {
  const skip = new Set(["fabric", "forge", "neoforge", "quilt", "iris", "optifine", "minecraft"]);
  const cats = (item.categories || []).filter((cat) => !skip.has(String(cat).toLowerCase())).slice(0, 3);
  const tags = [];
  if (item.installed) tags.push({ text: "Instalado", kind: "installed" });
  if (item.downloads) tags.push({ text: `${formatCount(item.downloads)} downloads` });
  for (const cat of cats) tags.push({ text: cat });
  return tags
    .map((tag) => `<span class="extra-tag${tag.kind ? ` ${tag.kind}` : ""}">${escapeHtml(tag.text)}</span>`)
    .join("");
}

function renderExtras(hits, { append = false, hasMore = false } = {}) {
  ui.extrasHint.textContent = extrasHint();
  const more = hasMore
    ? `<button type="button" class="ghost extra-more" data-action="more">Carregar mais</button>`
    : "";
  if (!hits.length && !append) {
    ui.extrasList.innerHTML = `<div class="extra-empty">Nada encontrado nesse filtro. Tente outra busca.</div>${more}`;
    return;
  }
  const cards = hits
    .map((item) => {
      const desc = escapeHtml((item.description || "").slice(0, 140));
      const title = escapeHtml(item.title);
      const icon = escapeHtml(item.icon || "../assets/icon.png");
      const tags = extraTags(item);
      const action = item.installed
        ? `<button type="button" class="remove" data-id="${escapeHtml(item.id)}" data-action="remove" aria-label="Remover ${title}">Remover</button>`
        : `<button type="button" data-id="${escapeHtml(item.id)}" data-type="${escapeHtml(item.type)}" data-action="install" aria-label="Instalar ${title}">Instalar</button>`;
      const open = state.extrasOpenId === item.id;
      const versions = open ? renderVersionList(item.id) : "";
      return `<article class="extra-item${open ? " is-open" : ""}" data-project="${escapeHtml(item.id)}">
        <img src="${icon}" alt="" onerror="this.onerror=null;this.src='../assets/icon.png'" />
        <div>
          <strong>${title}</strong>
          <small>${desc}</small>
          ${tags ? `<div class="extra-meta">${tags}</div>` : ""}
        </div>
        <div class="extra-actions">
          ${action}
          <button type="button" class="ghost-action" data-id="${escapeHtml(item.id)}" data-type="${escapeHtml(item.type)}" data-action="versions">${open ? "Fechar" : "Versões"}</button>
        </div>
        ${versions}
      </article>`;
    })
    .join("");
  if (append) {
    ui.extrasList.querySelector(".extra-more")?.remove();
    ui.extrasList.querySelector(".extra-empty")?.remove();
    ui.extrasList.insertAdjacentHTML("beforeend", cards + more);
    return;
  }
  ui.extrasList.innerHTML = cards + more;
}

async function loadExtras({ append = false } = {}) {
  if (!append) {
    ui.extrasList.innerHTML = `<div class="extra-empty">Buscando no Modrinth...</div>`;
    state.extrasHits = [];
    state.extrasOffset = 0;
    state.extrasOpenId = "";
  }
  ui.extrasHint.textContent = extrasHint();
  try {
    const data = await window.sitrus.searchExtras({
      type: state.extrasType,
      query: state.extrasQuery,
      offset: append ? state.extrasOffset : 0,
      category: state.extrasCategory,
      sort: state.extrasSort,
    });
    renderCategoryFilters(data.compat?.categories || []);
    state.extrasLoaded = true;
    state.extrasOffset = data.offset || 0;
    state.extrasHasMore = Boolean(data.hasMore);
    const hits = data.hits || [];
    state.extrasHits = append ? state.extrasHits.concat(hits) : hits;
    ui.extrasHint.textContent = extrasHint(data.total);
    renderExtras(append ? hits : state.extrasHits, { append, hasMore: state.extrasHasMore });
  } catch (error) {
    if (append) {
      ui.extrasHint.textContent = error.message || "Falha ao buscar extras.";
      return;
    }
    ui.extrasList.innerHTML = `<div class="extra-empty">${escapeHtml(error.message || "Falha ao buscar extras.")}<br /><button type="button" class="ghost" data-action="retry" style="margin-top:10px">Tentar de novo</button></div>`;
  }
}

document.querySelectorAll(".filter-type").forEach((button) => {
  button.onclick = () => {
    document.querySelectorAll(".filter-type").forEach((item) => {
      item.classList.remove("active");
      item.setAttribute("aria-pressed", "false");
    });
    button.classList.add("active");
    button.setAttribute("aria-pressed", "true");
    state.extrasType = button.dataset.type;
    state.extrasCategory = "";
    state.extrasOpenId = "";
    loadExtras();
  };
});

function renderCategoryFilters(categories) {
  if (!ui.extrasCategories) return;
  const all = `<button type="button" class="filter filter-cat${state.extrasCategory ? "" : " active"}" data-category="" aria-pressed="${state.extrasCategory ? "false" : "true"}">Todas</button>`;
  const chips = (categories || [])
    .map(([id, label]) => {
      const selected = state.extrasCategory === id;
      return `<button type="button" class="filter filter-cat${selected ? " active" : ""}" data-category="${escapeHtml(id)}" aria-pressed="${selected ? "true" : "false"}">${escapeHtml(label)}</button>`;
    })
    .join("");
  ui.extrasCategories.innerHTML = all + chips;
}

ui.extrasCategories?.addEventListener("click", (event) => {
  const button = event.target.closest(".filter-cat");
  if (!button) return;
  state.extrasCategory = button.dataset.category || "";
  loadExtras();
});

ui.extrasSort?.addEventListener("change", () => {
  state.extrasSort = ui.extrasSort.value;
  loadExtras();
});

function formatDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString("pt-BR");
  } catch {
    return "";
  }
}

function renderVersionList(projectId) {
  const data = state.extrasVersions[projectId];
  if (!data) {
    return `<div class="extra-versions"><div class="extra-empty">Carregando versões...</div></div>`;
  }
  if (!data.versions?.length) {
    return `<div class="extra-versions"><div class="extra-empty">Nenhuma versão publicada neste projeto.</div></div>`;
  }
  const rows = data.versions
    .map((item) => {
      const type = escapeHtml(item.versionType || "release");
      const games = escapeHtml((item.gameVersions || []).slice(0, 4).join(", "));
      const loaders = escapeHtml((item.loaders || []).join(", "));
      const installed = data.installedVersionId === item.id ? " · instalada" : "";
      const cls = item.compatible ? "" : " is-incompatible";
      const action = item.compatible
        ? `<button type="button" data-id="${escapeHtml(data.project.id)}" data-type="${escapeHtml(data.project.type)}" data-version="${escapeHtml(item.id)}" data-action="install">Instalar</button>`
        : `<button type="button" disabled>Incompatível</button>`;
      return `<div class="extra-version${cls}">
        <div>
          <strong>${escapeHtml(item.versionNumber || item.name)} <span class="ver-type ${type}">${type}</span></strong>
          <small>${games}${loaders ? ` · ${loaders}` : ""} · ${formatCount(item.downloads)} downloads · ${formatDate(item.date)}${installed}</small>
        </div>
        ${action}
      </div>`;
    })
    .join("");
  return `<div class="extra-versions">${rows}</div>`;
}

async function toggleVersions(id, type) {
  if (state.extrasOpenId === id) {
    state.extrasOpenId = "";
    renderExtras(state.extrasHits, { hasMore: state.extrasHasMore });
    return;
  }
  state.extrasOpenId = id;
  renderExtras(state.extrasHits, { hasMore: state.extrasHasMore });
  try {
    const data = await window.sitrus.extraVersions({ id, type });
    state.extrasVersions[id] = data;
    renderExtras(state.extrasHits, { hasMore: state.extrasHasMore });
  } catch (error) {
    state.extrasVersions[id] = { project: { id, type }, versions: [] };
    ui.extrasHint.textContent = error.message || "Não deu para listar as versões.";
    renderExtras(state.extrasHits, { hasMore: state.extrasHasMore });
  }
}

let searchTimer = null;
ui.extrasSearch.addEventListener("input", () => {
  state.extrasQuery = ui.extrasSearch.value;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadExtras, 350);
});

ui.extrasList.addEventListener("click", async (event) => {
  const retry = event.target.closest("button[data-action='retry']");
  if (retry) {
    loadExtras();
    return;
  }
  const more = event.target.closest("button[data-action='more']");
  if (more) {
    more.disabled = true;
    more.textContent = "Carregando...";
    loadExtras({ append: true });
    return;
  }
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  const id = button.dataset.id;
  if (action === "versions") {
    toggleVersions(id, button.dataset.type || state.extrasType);
    return;
  }
  if (action === "remove") {
    const ok = window.confirm("Remover este extra do launcher? Você pode instalar de novo depois.");
    if (!ok) return;
  }
  button.disabled = true;
  try {
    if (action === "install") {
      button.textContent = "Baixando...";
      ui.extrasHint.textContent = "Baixando e instalando na pasta do pack...";
      await window.sitrus.installExtra({
        id,
        type: button.dataset.type || state.extrasType,
        versionId: button.dataset.version || "",
      });
      state.extrasOpenId = "";
      state.extrasVersions = {};
    } else {
      button.textContent = "Removendo...";
      await window.sitrus.removeExtra(id);
    }
    await loadExtras();
  } catch (error) {
    button.disabled = false;
    button.textContent = action === "install" ? "Instalar" : "Remover";
    ui.extrasHint.textContent = error.message || "Não deu para concluir.";
  }
});

async function openPackFolder(kind = "root") {
  try {
    await window.sitrus.openFolder(kind);
  } catch (error) {
    if (ui.extrasHint) ui.extrasHint.textContent = error.message || "Não deu para abrir a pasta.";
  }
}

document.querySelectorAll(".settings-nav-item").forEach((button) => {
  button.onclick = () => {
    const target = button.dataset.settings;
    document.querySelectorAll(".settings-nav-item").forEach((item) => item.classList.toggle("active", item === button));
    document.querySelectorAll(".settings-page").forEach((page) => {
      page.hidden = page.dataset.settingsPage !== target;
    });
  };
});

function renderServer(status) {
  if (!ui.serverPlayers) return;
  const online = Boolean(status?.online);
  ui.serverDot?.classList.toggle("is-online", online);
  ui.serverDot?.classList.toggle("is-offline", !online && status);
  ui.serverLabel.textContent = state.pack?.server?.name || "Sitrus Cobblemon";
  ui.serverPlayers.textContent = online
    ? `${status.players}/${status.max} jogadores online`
    : "Servidor offline ou ocupado";
}

async function refreshServer() {
  try {
    renderServer(await window.sitrus.serverStatus());
  } catch {
    renderServer({ online: false });
  }
}

ui.openPackFolderBtn?.addEventListener("click", () => openPackFolder("root"));
ui.openPackFolderConfigBtn?.addEventListener("click", () => openPackFolder("root"));
ui.openExtrasFolderBtn?.addEventListener("click", () => openPackFolder(state.extrasType));

async function shareGameLog() {
  const buttons = [ui.shareLogBtn].filter(Boolean);
  const hint = ui.shareLogHint;
  const result = ui.shareLogResult;
  buttons.forEach((button) => {
    button.disabled = true;
    button.textContent = "Enviando log...";
  });
  if (hint) hint.textContent = "Lendo o último log e enviando para o mclo.gs...";
  if (result) {
    result.hidden = true;
    result.innerHTML = "";
  }
  try {
    const data = await window.sitrus.shareLog();
    const problems = data.insights?.problems || [];
    const info = data.insights?.information || [];
    const problemHtml = problems.length
      ? `<p>Problemas detectados:</p><ul>${problems
          .map((item) => `<li>${escapeHtml(item.message)}${item.solutions?.[0] ? ` — ${escapeHtml(item.solutions[0])}` : ""}</li>`)
          .join("")}</ul>`
      : "<p>O mclo.gs não apontou um crash específico neste log.</p>";
    const infoHtml = info.length
      ? `<ul>${info.map((item) => `<li>${escapeHtml(item.message || `${item.label}: ${item.value}`)}</li>`).join("")}</ul>`
      : "";
    const message = `Log enviado (${data.file}, ${data.lines} linhas, ${data.errors} erros). Link copiado.`;
    if (hint) hint.textContent = message;
    setStatus(message, 0);
    if (result) {
      result.hidden = false;
      result.innerHTML = `<p><a href="${escapeHtml(data.url)}" id="logLink">${escapeHtml(data.url)}</a></p>${problemHtml}${infoHtml}`;
    }
    if (data.url) window.sitrus.openExternal(data.url);
  } catch (error) {
    const text = error.message || "Não deu para enviar o log.";
    if (hint) hint.textContent = text;
    setStatus(text, 0, true);
  } finally {
    buttons.forEach((button) => {
      button.disabled = false;
      button.textContent = "Enviar log (mclo.gs)";
    });
  }
}

ui.shareLogBtn?.addEventListener("click", shareGameLog);

ui.shareLogResult?.addEventListener("click", (event) => {
  const link = event.target.closest("a");
  if (!link) return;
  event.preventDefault();
  window.sitrus.openExternal(link.href);
});

window.sitrus.onProgress((data) => {
  setStatus(data.message || "Trabalhando...", data.percent);
});

window.sitrus.onClosed((data) => {
  state.busy = false;
  renderAccount();
  const code = Number(data?.code) || 0;
  if (code !== 0) {
    setStatus(`O jogo fechou (código ${code}). Envie o log na aba Config se precisar de ajuda.`, 0, true);
  } else {
    setStatus("Jogo fechado. Pode jogar de novo quando quiser.", 0);
  }
});

window.sitrus.onUpdate((data) => {
  const bar = ui.launcherUpdate;
  const text = ui.launcherUpdateText;
  const btn = ui.restartUpdateBtn;
  if (!bar || !text || !btn) return;

  if (data.status === "available") {
    bar.hidden = false;
    btn.hidden = true;
    text.textContent = `Nova versão ${data.version} encontrada. Baixando...`;
    return;
  }
  if (data.status === "downloading") {
    bar.hidden = false;
    btn.hidden = true;
    text.textContent = `Baixando atualização do launcher... ${Math.round(data.percent || 0)}%`;
    return;
  }
  if (data.status === "ready") {
    bar.hidden = false;
    btn.hidden = false;
    text.textContent = `Versão ${data.version} pronta. Reinicie para atualizar.`;
    return;
  }
  bar.hidden = true;
  btn.hidden = true;
});

ui.restartUpdateBtn.onclick = () => window.sitrus.installUpdate();

async function boot() {
  const data = await window.sitrus.bootstrap();
  state.pack = data.pack;
  state.settings = data.settings;
  state.account = data.account;
  bindSettings();
  renderAccount();
  renderServer(data.server);
  showTab(["home", "extras", "config"].includes(data.settings?.lastTab) ? data.settings.lastTab : "home");
  setInterval(refreshServer, 60000);
  const latest = data.status?.latest?.versionNumber;
  const installed = data.status?.installed?.versionNumber;
  ui.updateHint.textContent = data.status?.updateAvailable
    ? `Atualização pendente (${installed || "não instalado"} → ${latest})`
    : installed
      ? "Instalado e atualizado"
      : "Ainda não instalado neste PC";
  setStatus(state.account ? `Bem-vindo, ${state.account.name}.` : "Entre para instalar e jogar.");
  if (ui.launcherVersion) {
    ui.launcherVersion.textContent = data.launcherVersion || "dev";
  }
  ui.packVersion.textContent = latest
    ? `Pack ${latest} · Fabric 1.21.1`
    : "Pack Sitrus · Fabric 1.21.1";
}

boot().catch((error) => setStatus(error.message, 0, true));

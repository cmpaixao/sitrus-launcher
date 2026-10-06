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
  checkUpdates: document.getElementById("checkUpdates"),
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
  configHint: document.getElementById("configAccountHint"),
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
  shareLogHomeBtn: document.getElementById("shareLogHomeBtn"),
  shareLogHint: document.getElementById("shareLogHint"),
  shareLogResult: document.getElementById("shareLogResult"),
};

let state = {
  pack: null,
  settings: null,
  account: null,
  busy: false,
  extrasType: "mod",
  extrasQuery: "",
  extrasLoaded: false,
  extrasLoader: "fabric",
  packLoader: "fabric",
  extrasOffset: 0,
  extrasHasMore: false,
  extrasHits: [],
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
  ui.playBtn.textContent = state.busy ? "Preparando..." : account ? "Jogar" : "Entrar para jogar";
  ui.playBtn.title = !account
    ? "Entre com uma conta para jogar"
    : state.busy
      ? "O launcher está preparando o jogo"
      : "Iniciar o Sitrus Cobblemon";
  ui.playBtn.setAttribute("aria-busy", state.busy ? "true" : "false");
  if (ui.logoutBtn) ui.logoutBtn.hidden = !account;
  if (ui.configHint) {
    ui.configHint.textContent = account
      ? `Conectado como ${account.name}. Trocar conta volta para o login.`
      : "Entre na aba Jogar para conectar uma conta.";
  }
  if (!account) return;
  ui.playerName.textContent = account.name;
  ui.accountType.textContent = account.type === "microsoft" ? "Conta Microsoft" : "Offline";
  ui.avatar.src = account.avatar || "../assets/icon.png";
}

function bindSettings() {
  const settings = state.settings;
  ui.ram.value = settings.ramGb;
  ui.ramValue.textContent = settings.ramGb;
  ui.closeOnPlay.checked = settings.closeOnPlay;
  ui.checkUpdates.checked = Boolean(settings.checkUpdatesOnPlay);
  ui.serverAddress.value = settings.serverAddress || "";
}

async function persistSettings() {
  state.settings = await window.sitrus.saveSettings({
    ramGb: Number(ui.ram.value),
    closeOnPlay: ui.closeOnPlay.checked,
    checkUpdatesOnPlay: ui.checkUpdates.checked,
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
ui.checkUpdates.onchange = persistSettings;
ui.serverAddress.onchange = persistSettings;

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
  setStatus(
    ui.checkUpdates.checked ? "Buscando atualização e preparando o Sitrus..." : "Preparando o Sitrus...",
    4
  );
  const result = await window.sitrus.play();
  if (!result.ok) {
    state.busy = false;
    renderAccount();
    setStatus(result.message || "Não deu pra abrir o jogo.", 0, true);
  }
};

function loaderName(loader) {
  if (loader === "neoforge") return "NeoForge";
  if (loader === "forge") return "Forge";
  return "Fabric";
}

function extrasHint(total) {
  const pack = loaderName(state.packLoader);
  const selected = loaderName(state.extrasLoader);
  const count = typeof total === "number" ? ` ${total} resultados.` : "";
  if (state.extrasLoader !== state.packLoader) {
    return `O pack Sitrus é ${pack}. ${selected} não carrega neste jogo.${count}`;
  }
  if (state.extrasType === "mod") {
    return `Mods ${selected} ${state.pack?.mcVersion || "1.21.1"} compatíveis com o pack. O que já vem no Sitrus não aparece.${count}`;
  }
  if (state.extrasType === "resourcepack") {
    return `Texturas para Minecraft ${state.pack?.mcVersion || "1.21.1"}. Ative no jogo em Opções > Resource Packs.${count}`;
  }
  return `Shaders compatíveis com ${selected === "Fabric" ? "Iris" : "Oculus"}. Ative no menu do shader no jogo.${count}`;
}

function setLoaderButtons() {
  document.querySelectorAll(".filter-loader").forEach((button) => {
    const selected = button.dataset.loader === state.extrasLoader;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", selected ? "true" : "false");
    button.dataset.pack = button.dataset.loader === state.packLoader ? "true" : "false";
  });
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
      const desc = escapeHtml((item.description || "").slice(0, 110));
      const title = escapeHtml(item.title);
      const icon = escapeHtml(item.icon || "../assets/icon.png");
      const mismatch = item.loader && item.loader !== state.packLoader;
      const action = item.installed
        ? `<button type="button" class="remove" data-id="${escapeHtml(item.id)}" data-action="remove" aria-label="Remover ${title}">Remover</button>`
        : `<button type="button" data-id="${escapeHtml(item.id)}" data-type="${escapeHtml(item.type)}" data-action="install" aria-label="Instalar ${title}">Instalar</button>`;
      return `<article class="extra-item">
        <img src="${icon}" alt="${title}" />
        <div>
          <strong>${title}</strong>
          <small>${desc}${mismatch ? ` · ${escapeHtml(loaderName(item.loader))}` : ""}</small>
        </div>
        ${action}
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
  }
  ui.extrasHint.textContent = extrasHint();
  try {
    const data = await window.sitrus.searchExtras({
      type: state.extrasType,
      query: state.extrasQuery,
      offset: append ? state.extrasOffset : 0,
      loader: state.extrasLoader,
    });
    state.extrasLoaded = true;
    state.extrasOffset = data.offset || 0;
    state.extrasHasMore = Boolean(data.hasMore);
    if (data.compat?.packLoader) state.packLoader = data.compat.packLoader;
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
    loadExtras();
  };
});

document.querySelectorAll(".filter-loader").forEach((button) => {
  button.onclick = () => {
    state.extrasLoader = button.dataset.loader;
    setLoaderButtons();
    loadExtras();
  };
});

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
  if (action === "remove") {
    const ok = window.confirm("Remover este extra do launcher? Você pode instalar de novo depois.");
    if (!ok) return;
  }
  if (action === "install" && state.extrasLoader !== state.packLoader) {
    const ok = window.confirm(
      `O pack Sitrus é ${loaderName(state.packLoader)}. Instalar um extra ${loaderName(state.extrasLoader)} pode não abrir no jogo. Continuar?`
    );
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
        loader: state.extrasLoader,
      });
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

ui.openPackFolderBtn?.addEventListener("click", () => openPackFolder("root"));
ui.openPackFolderConfigBtn?.addEventListener("click", () => openPackFolder("root"));
ui.openExtrasFolderBtn?.addEventListener("click", () => openPackFolder(state.extrasType));

async function shareGameLog() {
  const buttons = [ui.shareLogBtn, ui.shareLogHomeBtn].filter(Boolean);
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
ui.shareLogHomeBtn?.addEventListener("click", shareGameLog);

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
    setStatus(`O jogo fechou (código ${code}). Envie o log pelo mclo.gs se precisar de ajuda.`, 0, true);
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
  showTab(["home", "extras", "config"].includes(data.settings?.lastTab) ? data.settings.lastTab : "home");
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
  if (data.compat?.loader) {
    state.packLoader = data.compat.loader;
    state.extrasLoader = data.compat.loader;
    if (data.compat.mcVersion) state.pack = { ...(state.pack || {}), mcVersion: data.compat.mcVersion };
    setLoaderButtons();
  }
  const loaderText = loaderName(state.packLoader);
  const mcText = data.compat?.mcVersion || "1.21.1";
  ui.packVersion.textContent = latest
    ? `Pack ${latest} · ${loaderText} ${mcText}`
    : `Pack Sitrus · ${loaderText} ${mcText}`;
}

boot().catch((error) => setStatus(error.message, 0, true));

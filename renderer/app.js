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
};

let state = {
  pack: null,
  settings: null,
  account: null,
  busy: false,
  extrasType: "mod",
  extrasQuery: "",
  extrasLoaded: false,
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

function extrasHint() {
  if (state.extrasType === "mod") {
    return "Mods só de client: HUD, desempenho visual, minimapa. Nada que precise estar no servidor.";
  }
  if (state.extrasType === "resourcepack") {
    return "Resource packs compatíveis com Minecraft 1.21.1. Ative no jogo em Opções > Resource Packs.";
  }
  return "Shaders para Iris. Se ainda não tiver Iris, o launcher instala junto. Ative no menu do Iris (padrão: K).";
}

function renderExtras(hits) {
  ui.extrasHint.textContent = extrasHint();
  if (!hits.length) {
    ui.extrasList.innerHTML = `<div class="extra-empty">Nada encontrado nesse filtro. Tente outra busca.</div>`;
    return;
  }
  ui.extrasList.innerHTML = hits
    .map((item) => {
      const desc = escapeHtml((item.description || "").slice(0, 110));
      const title = escapeHtml(item.title);
      const icon = escapeHtml(item.icon || "../assets/icon.png");
      const action = item.installed
        ? `<button type="button" class="remove" data-id="${escapeHtml(item.id)}" data-action="remove" aria-label="Remover ${title}">Remover</button>`
        : `<button type="button" data-id="${escapeHtml(item.id)}" data-type="${escapeHtml(item.type)}" data-action="install" aria-label="Instalar ${title}">Instalar</button>`;
      return `<article class="extra-item">
        <img src="${icon}" alt="${title}" />
        <div>
          <strong>${title}</strong>
          <small>${desc}</small>
        </div>
        ${action}
      </article>`;
    })
    .join("");
}

async function loadExtras() {
  ui.extrasList.innerHTML = `<div class="extra-empty">Buscando no Modrinth...</div>`;
  ui.extrasHint.textContent = extrasHint();
  try {
    const data = await window.sitrus.searchExtras({
      type: state.extrasType,
      query: state.extrasQuery,
      offset: 0,
    });
    state.extrasLoaded = true;
    renderExtras(data.hits || []);
  } catch (error) {
    ui.extrasList.innerHTML = `<div class="extra-empty">${escapeHtml(error.message || "Falha ao buscar extras.")}<br /><button type="button" class="ghost" data-action="retry" style="margin-top:10px">Tentar de novo</button></div>`;
  }
}

document.querySelectorAll(".filter").forEach((button) => {
  button.onclick = () => {
    document.querySelectorAll(".filter").forEach((item) => {
      item.classList.remove("active");
      item.setAttribute("aria-pressed", "false");
    });
    button.classList.add("active");
    button.setAttribute("aria-pressed", "true");
    state.extrasType = button.dataset.type;
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
  const button = event.target.closest("button[data-action]");
  if (!button || state.busy) return;
  const action = button.dataset.action;
  const id = button.dataset.id;
  if (action === "remove") {
    const ok = window.confirm("Remover este extra do launcher? Você pode instalar de novo depois.");
    if (!ok) return;
  }
  button.disabled = true;
  try {
    if (action === "install") {
      button.textContent = "Baixando...";
      await window.sitrus.installExtra({ id, type: button.dataset.type });
    } else {
      button.textContent = "Removendo...";
      await window.sitrus.removeExtra(id);
    }
    await loadExtras();
  } catch (error) {
    button.disabled = false;
    ui.extrasHint.textContent = error.message || "Não deu para concluir.";
  }
});

window.sitrus.onProgress((data) => {
  setStatus(data.message || "Trabalhando...", data.percent);
});

window.sitrus.onClosed(() => {
  state.busy = false;
  renderAccount();
  setStatus("Jogo fechado. Pode jogar de novo quando quiser.", 0);
});

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
  ui.packVersion.textContent = latest ? `Pack ${latest} · Fabric 1.21.1` : "Pack Sitrus · Fabric 1.21.1";
  ui.updateHint.textContent = data.status?.updateAvailable
    ? `Atualização pendente (${installed || "não instalado"} → ${latest})`
    : installed
      ? "Instalado e atualizado"
      : "Ainda não instalado neste PC";
  setStatus(state.account ? `Bem-vindo, ${state.account.name}.` : "Entre para instalar e jogar.");
}

boot().catch((error) => setStatus(error.message, 0, true));

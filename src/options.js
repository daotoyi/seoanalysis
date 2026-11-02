import { COUNTRIES } from "./engine.js";
import {
  applyTranslations,
  resolveLanguage,
  t,
  translateError
} from "./i18n.js";

const els = {
  form: document.querySelector("#settingsForm"),
  planBadge: document.querySelector("#planBadge"),
  statusTitle: document.querySelector("#statusTitle"),
  statusCopy: document.querySelector("#statusCopy"),
  enabledToggle: document.querySelector("#enabledToggle"),
  compactToggle: document.querySelector("#compactToggle"),
  relatedToggle: document.querySelector("#relatedToggle"),
  countrySelect: document.querySelector("#countrySelect"),
  languageSelect: document.querySelector("#languageSelect"),
  dataForSeoFields: document.querySelector("#dataForSeoFields"),
  dataForSeoLogin: document.querySelector("#dataForSeoLogin"),
  dataForSeoPassword: document.querySelector("#dataForSeoPassword"),
  togglePasswordButton: document.querySelector("#togglePasswordButton"),
  testConnectionButton: document.querySelector("#testConnectionButton"),
  clearCredentialsButton: document.querySelector("#clearCredentialsButton"),
  connectionResult: document.querySelector("#connectionResult"),
  clearCacheButton: document.querySelector("#clearCacheButton"),
  exportDataButton: document.querySelector("#exportDataButton"),
  resetDataButton: document.querySelector("#resetDataButton"),
  trialButton: document.querySelector("#trialButton"),
  headerTrialButton: document.querySelector("#headerTrialButton"),
  trialTitle: document.querySelector("#trialTitle"),
  trialCopy: document.querySelector("#trialCopy"),
  saveStatus: document.querySelector("#saveStatus"),
  openSearchButton: document.querySelector("#openSearchButton"),
  closeTabButton: document.querySelector("#closeTabButton"),
  toast: document.querySelector("#toast")
};

let state = null;
let toastTimer = null;
let credentialConfigured = false;
let manuallyClearedCredentials = false;

function currentLanguage() {
  return resolveLanguage(state?.settings?.language || "auto");
}

function tr(key, params) {
  return t(currentLanguage(), key, params);
}

function localizeError(error) {
  return translateError(error, currentLanguage());
}

function applyLanguage() {
  applyTranslations(document, currentLanguage());
  document.title = tr("options.title");
  const showingPassword = els.dataForSeoPassword.type === "text";
  els.togglePasswordButton.title = tr(
    showingPassword ? "options.hidePassword" : "options.showPassword"
  );
  els.togglePasswordButton.setAttribute("aria-label", els.togglePasswordButton.title);
}

function refreshIcons() {
  window.lucide?.createIcons({
    attrs: {
      "aria-hidden": "true",
      "stroke-width": 1.9
    }
  });
}

async function send(type, payload) {
  const response = await chrome.runtime.sendMessage({ type, payload });
  if (!response?.ok) {
    const error = new Error(response?.error?.message || "Operation failed");
    error.code = response?.error?.code;
    throw error;
  }
  return response.result;
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => els.toast.classList.remove("is-visible"), 2200);
}

function populateCountries() {
  const previousCountry = els.countrySelect.value;
  els.countrySelect.innerHTML = Object.values(COUNTRIES)
    .map(
      (country) =>
        `<option value="${country.code}">${tr(`common.country.${country.code}`)} (${country.code})</option>`
    )
    .join("");
  if (previousCountry) els.countrySelect.value = previousCountry;
  els.languageSelect.innerHTML = `
    <option value="auto">${tr("common.languageAuto")}</option>
    <option value="zh">${tr("common.languageZh")}</option>
    <option value="en">${tr("common.languageEn")}</option>
  `;
}

function selectedDataSource() {
  return document.querySelector('input[name="dataSource"]:checked')?.value || "local";
}

function updateDataSourceVisibility() {
  els.dataForSeoFields.hidden = selectedDataSource() !== "dataforseo";
}

function renderPlan() {
  const isPro = state.plan === "pro";
  const locale = currentLanguage() === "zh" ? "zh-CN" : "en-US";
  applyLanguage();
  els.planBadge.textContent = isPro ? "PRO" : "FREE";
  els.planBadge.dataset.plan = state.plan;
  els.headerTrialButton.hidden = isPro;
  const canStartTrial = !isPro && !state.trialUsed;
  els.headerTrialButton.disabled = !canStartTrial;
  els.trialButton.disabled = !canStartTrial;
  els.trialButton.innerHTML = isPro
    ? `<i data-lucide="badge-check"></i><span>${tr("options.trialEnabled")}</span>`
    : canStartTrial
      ? `<i data-lucide="sparkles"></i><span>${tr("options.startTrial")}</span>`
      : `<i data-lucide="history"></i><span>${tr("options.trialEnded")}</span>`;

  if (isPro) {
    els.statusTitle.textContent = tr("options.proEnabled");
    els.statusCopy.textContent = state.trialEndsAt
      ? tr("options.proUntil", {
          date: new Date(state.trialEndsAt).toLocaleDateString(locale)
        })
      : tr("options.proOpen");
    els.trialTitle.textContent = tr("options.trialProTitle");
    els.trialCopy.textContent = state.trialEndsAt
      ? tr("options.proUntil", {
          date: new Date(state.trialEndsAt).toLocaleDateString(locale)
        })
      : tr("options.trialProDesc");
  } else if (!state.trialUsed) {
    els.statusTitle.textContent = state.settings.enabled
      ? tr("options.running")
      : tr("options.paused");
    els.statusCopy.textContent = tr("options.freeQuota", {
      remaining: state.quota.remaining,
      limit: state.quota.limit
    });
    els.trialTitle.textContent = tr("options.trialTitle");
    els.trialCopy.textContent = tr("options.trialDesc");
  } else {
    els.statusTitle.textContent = state.settings.enabled
      ? tr("options.running")
      : tr("options.paused");
    els.statusCopy.textContent = tr("options.freeQuota", {
      remaining: state.quota.remaining,
      limit: state.quota.limit
    });
    els.trialTitle.textContent = tr("options.trialUsedTitle");
    els.trialCopy.textContent = tr("options.trialUsedDesc");
  }
  refreshIcons();
}

function fillForm() {
  document.querySelectorAll('input[name="dataSource"]').forEach((input) => {
    input.checked = input.value === state.settings.dataSource;
  });
  els.enabledToggle.checked = Boolean(state.settings.enabled);
  els.compactToggle.checked = Boolean(state.settings.compactSerp);
  els.relatedToggle.checked = Boolean(state.settings.showRelated);
  els.countrySelect.value = state.settings.country;
  els.languageSelect.value = state.settings.language || "auto";
  credentialConfigured =
    state.settings.dataForSeoLogin === "configured" ||
    state.settings.dataForSeoPassword === "configured";
  els.dataForSeoLogin.value = credentialConfigured ? "" : state.settings.dataForSeoLogin || "";
  els.dataForSeoPassword.value = "";
  els.dataForSeoLogin.placeholder = credentialConfigured
    ? tr("options.keepPlaceholder")
    : "name@example.com";
  els.dataForSeoPassword.placeholder = credentialConfigured
    ? tr("options.keepPlaceholder")
    : "••••••••••••";
  updateDataSourceVisibility();
}

async function saveSettings(event) {
  if (event) event.preventDefault();
  const payload = {
    enabled: els.enabledToggle.checked,
    compactSerp: els.compactToggle.checked,
    showRelated: els.relatedToggle.checked,
    country: els.countrySelect.value,
    dataSource: selectedDataSource(),
    language: els.languageSelect.value
  };

  if (els.dataForSeoLogin.value.trim()) {
    payload.dataForSeoLogin = els.dataForSeoLogin.value.trim();
  } else if (credentialConfigured && !manuallyClearedCredentials) {
    payload.dataForSeoLogin = "configured";
  }

  if (els.dataForSeoPassword.value.trim()) {
    payload.dataForSeoPassword = els.dataForSeoPassword.value.trim();
  } else if (credentialConfigured && !manuallyClearedCredentials) {
    payload.dataForSeoPassword = "configured";
  }

  if (manuallyClearedCredentials) {
    payload.dataForSeoLogin = "";
    payload.dataForSeoPassword = "";
  }

  try {
    state = await send("UPDATE_SETTINGS", payload);
    manuallyClearedCredentials = false;
    applyLanguage();
    populateCountries();
    fillForm();
    renderPlan();
    const locale = currentLanguage() === "zh" ? "zh-CN" : "en-US";
    els.saveStatus.textContent = tr("options.savedAt", {
      time: new Date().toLocaleTimeString(locale, {
        hour: "2-digit",
        minute: "2-digit"
      })
    });
    showToast(tr("options.toastSaved"));
  } catch (error) {
    showToast(localizeError(error));
  }
}

async function testConnection() {
  const login = els.dataForSeoLogin.value.trim();
  const password = els.dataForSeoPassword.value.trim();
  if (!login && !credentialConfigured) {
    els.connectionResult.textContent = tr("options.testNeedLogin");
    els.connectionResult.dataset.tone = "error";
    return;
  }
  if (!password && !credentialConfigured) {
    els.connectionResult.textContent = tr("options.testNeedPassword");
    els.connectionResult.dataset.tone = "error";
    return;
  }

  els.testConnectionButton.disabled = true;
  els.connectionResult.textContent = tr("options.testing");
  els.connectionResult.dataset.tone = "";
  try {
    const result = await send("TEST_DATAFORSEO", {
      dataForSeoLogin: login || "configured",
      dataForSeoPassword: password || "configured"
    });
    els.connectionResult.textContent = tr("options.connectionSuccess", {
      volume: result.sample.volume
    });
    els.connectionResult.dataset.tone = "success";
  } catch (error) {
    els.connectionResult.textContent = localizeError(error);
    els.connectionResult.dataset.tone = "error";
  } finally {
    els.testConnectionButton.disabled = false;
  }
}

async function startTrial() {
  try {
    state = await send("START_TRIAL");
    fillForm();
    renderPlan();
    showToast(tr("options.toastTrial"));
  } catch (error) {
    showToast(localizeError(error));
  }
}

async function clearCache() {
  try {
    await send("CLEAR_CACHE");
    showToast(tr("options.toastCacheCleared"));
  } catch (error) {
    showToast(localizeError(error));
  }
}

function downloadBlob(contents, type, filename) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function exportData() {
  try {
    state = await send("GET_STATE");
    const payload = {
      exportedAt: new Date().toISOString(),
      product: "SEOanalysis",
      saved: state.saved,
      history: state.history
    };
    downloadBlob(
      JSON.stringify(payload, null, 2),
      "application/json;charset=utf-8",
      `seoanalysis-backup-${new Date().toISOString().slice(0, 10)}.json`
    );
    showToast(tr("options.toastExported"));
  } catch (error) {
    showToast(localizeError(error));
  }
}

async function resetData() {
  const confirmed = window.confirm(tr("options.confirmReset"));
  if (!confirmed) return;
  try {
    await send("RESET_DEMO");
    state = await send("GET_STATE");
    fillForm();
    renderPlan();
    showToast(tr("options.toastReset"));
  } catch (error) {
    showToast(localizeError(error));
  }
}

function bindEvents() {
  els.form.addEventListener("submit", saveSettings);
  document.querySelectorAll('input[name="dataSource"]').forEach((input) => {
    input.addEventListener("change", () => {
      updateDataSourceVisibility();
      saveSettings();
    });
  });
  [
    els.enabledToggle,
    els.compactToggle,
    els.relatedToggle,
    els.countrySelect,
    els.languageSelect
  ].forEach((control) => control.addEventListener("change", () => saveSettings()));
  els.togglePasswordButton.addEventListener("click", () => {
    const show = els.dataForSeoPassword.type === "password";
    els.dataForSeoPassword.type = show ? "text" : "password";
    els.togglePasswordButton.innerHTML = show
      ? '<i data-lucide="eye-off"></i>'
      : '<i data-lucide="eye"></i>';
    els.togglePasswordButton.title = show
      ? tr("options.hidePassword")
      : tr("options.showPassword");
    els.togglePasswordButton.setAttribute("aria-label", els.togglePasswordButton.title);
    refreshIcons();
  });
  els.testConnectionButton.addEventListener("click", testConnection);
  els.clearCredentialsButton.addEventListener("click", () => {
    manuallyClearedCredentials = true;
    credentialConfigured = false;
    els.dataForSeoLogin.value = "";
    els.dataForSeoPassword.value = "";
    els.connectionResult.textContent = tr("options.credentialsWillClear");
    els.connectionResult.dataset.tone = "";
    saveSettings();
  });
  els.trialButton.addEventListener("click", startTrial);
  els.headerTrialButton.addEventListener("click", startTrial);
  els.clearCacheButton.addEventListener("click", clearCache);
  els.exportDataButton.addEventListener("click", exportData);
  els.resetDataButton.addEventListener("click", resetData);
  els.openSearchButton.addEventListener("click", () => {
    chrome.tabs.create({ url: "https://www.google.com/" });
  });
  els.closeTabButton.addEventListener("click", () => window.close());
}

async function initialize() {
  bindEvents();
  try {
    state = await send("GET_STATE");
    applyLanguage();
    populateCountries();
    fillForm();
    renderPlan();
  } catch (error) {
    showToast(localizeError(error));
  }
  refreshIcons();
}

initialize();

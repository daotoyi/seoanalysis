import {
  COUNTRIES,
  formatCurrency,
  formatVolume
} from "./engine.js";
import {
  applyTranslations,
  nextLanguagePreference,
  resolveLanguage,
  t,
  translateError
} from "./i18n.js";

const els = {
  searchForm: document.querySelector("#searchForm"),
  keywordInput: document.querySelector("#keywordInput"),
  countrySelect: document.querySelector("#countrySelect"),
  analyzeButton: document.querySelector(".analyze-button"),
  planBadge: document.querySelector("#planBadge"),
  languageButton: document.querySelector("#languageButton"),
  languageButtonText: document.querySelector("#languageButtonText"),
  quotaBar: document.querySelector("#quotaBar"),
  quotaText: document.querySelector("#quotaText"),
  quotaFill: document.querySelector("#quotaFill"),
  analysisContent: document.querySelector("#analysisContent"),
  savedContent: document.querySelector("#savedContent"),
  historyContent: document.querySelector("#historyContent"),
  savedCount: document.querySelector("#savedCount"),
  savedMeta: document.querySelector("#savedMeta"),
  exportButton: document.querySelector("#exportButton"),
  upgradeFooter: document.querySelector("#upgradeFooter"),
  trialButton: document.querySelector("#trialButton"),
  trialInlineButton: document.querySelector("#trialInlineButton"),
  settingsButton: document.querySelector("#settingsButton"),
  openOptionsButton: document.querySelector("#openOptionsButton"),
  toast: document.querySelector("#toast")
};

let state = null;
let currentMetrics = null;
let activeView = "analysis";
let toastTimer = null;

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
  els.languageButtonText.textContent = currentLanguage() === "zh" ? "中" : "EN";
  els.languageButton.title = tr("common.language");
  els.languageButton.setAttribute("aria-label", tr("common.language"));
  document.title = "SEOanalysis";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
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
    const error = new Error(response?.error?.message || t(resolveLanguage("auto"), "error.UNKNOWN"));
    error.code = response?.error?.code;
    throw error;
  }
  return response.result;
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => els.toast.classList.remove("is-visible"), 1800);
}

function populateCountries() {
  els.countrySelect.innerHTML = Object.values(COUNTRIES)
    .map(
      (country) =>
        `<option value="${country.code}" title="${country.label}">${country.code}</option>`
    )
    .join("");
}

function metricTone(competition) {
  if (competition >= 75) return "risk";
  if (competition >= 55) return "warn";
  return "good";
}

function buildTrendSvg(trend) {
  const values = trend.map((point) => point.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const width = 336;
  const height = 62;
  const points = values
    .map((value, index) => {
      const x = 5 + (index / Math.max(1, values.length - 1)) * (width - 10);
      const normalized = max === min ? 0.5 : (value - min) / (max - min);
      const y = height - 7 - normalized * (height - 16);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const areaPoints = `5,${height - 1} ${points} ${width - 5},${height - 1}`;
  return `
    <svg class="trend-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(tr("common.trend12"))}">
      <defs>
        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#c52f3d" stop-opacity=".2"></stop>
          <stop offset="1" stop-color="#c52f3d" stop-opacity="0"></stop>
        </linearGradient>
      </defs>
      <line x1="5" y1="${height - 1}" x2="${width - 5}" y2="${height - 1}" stroke="#eadadd"></line>
      <polygon points="${areaPoints}" fill="url(#trendFill)"></polygon>
      <polyline points="${points}" fill="none" stroke="#c52f3d" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></polyline>
    </svg>
  `;
}

function renderEmptyAnalysis() {
  const suggestions =
    currentLanguage() === "zh"
      ? ["seo audit", "跨境电商", "ai seo tools"]
      : ["seo audit", "ecommerce seo", "ai seo tools"];
  els.analysisContent.innerHTML = `
    <div class="empty-state">
      <span class="empty-state-icon"><i data-lucide="scan-search"></i></span>
      <h3>${escapeHtml(tr("popup.emptyTitle"))}</h3>
      <p>${escapeHtml(tr("popup.emptyDesc"))}</p>
      <div class="suggestion-row">
        ${suggestions
          .map(
            (keyword) =>
              `<button class="suggestion-chip" type="button">${escapeHtml(keyword)}</button>`
          )
          .join("")}
      </div>
    </div>
  `;
  els.analysisContent.querySelectorAll(".suggestion-chip").forEach((button) => {
    button.addEventListener("click", () => {
      els.keywordInput.value = button.textContent.trim();
      analyzeCurrentInput();
    });
  });
  refreshIcons();
}

function renderLoading() {
  els.analysisContent.innerHTML = `
    <div class="loading-state">
      <span class="loading-orb"></span>
      <p>${escapeHtml(tr("popup.loading"))}</p>
    </div>
  `;
}

function renderError(message) {
  els.analysisContent.innerHTML = `
    <div class="error-panel">${escapeHtml(message)}</div>
  `;
}

function proLockedMarkup(plan) {
  if (plan === "pro") return "";
  return `
    <div class="locked-panel">
      <span class="locked-icon"><i data-lucide="lock-keyhole"></i></span>
      <span class="locked-copy">
        <strong>${escapeHtml(tr("popup.lockedTitle"))}</strong>
        <span>${escapeHtml(tr("popup.lockedDesc"))}</span>
      </span>
      <button class="unlock-inline" data-action="trial" type="button">${escapeHtml(tr("common.try"))}</button>
    </div>
  `;
}

function renderMetrics(metrics, plan) {
  currentMetrics = metrics;
  const isSaved = state.saved.some(
    (item) => item.keyword === metrics.keyword && item.country === metrics.country
  );
  const tone = metricTone(metrics.competition);
  const countryName = tr(`common.country.${metrics.country}`);
  const sourceCopy = metrics.exact
    ? `${tr("common.exactData")} · ${tr("common.source.dataforseo")}`
    : tr("common.localEstimate");
  const volumeBand = tr(`common.volumeBand.${metrics.volumeBand.key}`);
  const competitionBand = tr(`common.competitionBand.${metrics.competitionBand.key}`);
  const intentLabel = tr(`common.intent.${metrics.intent}`);
  const opportunityBand =
    metrics.opportunityBand ||
    (metrics.opportunity >= 75
      ? "strong"
      : metrics.opportunity >= 58
        ? "test"
        : metrics.opportunity >= 40
          ? "differentiate"
          : "cautious");
  const opportunityLabel = tr(`common.opportunityBand.${opportunityBand}`);

  els.analysisContent.innerHTML = `
    <div class="result-header">
      <div class="result-heading">
        <div class="result-eyebrow">
          <span class="source-dot" data-exact="${metrics.exact}"></span>
          ${escapeHtml(sourceCopy)} · ${escapeHtml(metrics.country)}
        </div>
        <h1 class="result-keyword" title="${escapeHtml(metrics.keyword)}">${escapeHtml(metrics.keyword)}</h1>
      </div>
      <div class="result-actions">
        <button class="mini-icon-button" type="button" title="${escapeHtml(tr("popup.copyTitle"))}" data-action="copy">
          <i data-lucide="copy"></i>
        </button>
        <button class="mini-icon-button" type="button" title="${escapeHtml(isSaved ? tr("popup.savedTitle") : tr("popup.saveTitle"))}" data-action="save">
          <i data-lucide="${isSaved ? "bookmark-check" : "bookmark-plus"}"></i>
        </button>
      </div>
    </div>
    <div class="hero-metric">
      <div class="hero-volume">
        <span>${escapeHtml(tr("popup.volumeLabel", { country: countryName }))}</span>
        <strong>${formatVolume(metrics.volume)}</strong><small>${escapeHtml(volumeBand)}</small>
      </div>
      <div class="opportunity-badge">
        <span>${escapeHtml(tr("popup.opportunityScore"))}</span>
        <strong>${metrics.opportunity}/100</strong>
      </div>
    </div>
    <div class="metric-row">
      <div class="compact-metric">
        <span>${escapeHtml(tr("common.competition"))}</span>
        <strong>${metrics.competition}/100</strong>
        <em>${escapeHtml(competitionBand)}</em>
      </div>
      <div class="compact-metric">
        <span>${escapeHtml(tr("common.cpc"))}</span>
        <strong>${formatCurrency(metrics.cpc)}</strong>
        <em>${escapeHtml(metrics.exact ? tr("common.cpcBidMedian") : tr("common.cpcEstimate"))}</em>
      </div>
      <div class="compact-metric">
        <span>${escapeHtml(tr("common.intent"))}</span>
        <strong>${escapeHtml(intentLabel)}</strong>
        <em>${escapeHtml(opportunityLabel)}</em>
      </div>
    </div>
    <div class="progress-block">
      <div class="progress-copy">
        <span>${escapeHtml(tr("common.difficulty"))}</span>
        <strong>${metrics.difficulty}/100 · ${difficultyCopy(metrics.difficulty)}</strong>
      </div>
      <div class="progress-track">
        <span data-tone="${tone}" style="width:${metrics.difficulty}%"></span>
      </div>
    </div>
    <div class="pro-section">
      <div class="section-row-title">
        <strong><i data-lucide="chart-no-axes-combined"></i> ${escapeHtml(tr("common.trend12"))}</strong>
        <span>${escapeHtml(metrics.exact ? tr("popup.trendNoteExact") : tr("popup.trendNoteSeasonal"))}</span>
      </div>
      ${
        plan === "pro"
          ? `${buildTrendSvg(metrics.trend)}
             <div class="trend-months"><span>${escapeHtml(formatMonth(metrics.trend[0]?.month))}</span><span>${escapeHtml(formatMonth(metrics.trend[5]?.month))}</span><span>${escapeHtml(formatMonth(metrics.trend[11]?.month))}</span></div>`
          : proLockedMarkup(plan)
      }
    </div>
    ${
      plan === "pro"
        ? `<div class="pro-section">
            <div class="section-row-title">
              <strong><i data-lucide="git-branch-plus"></i> ${escapeHtml(tr("common.relatedOpportunities"))}</strong>
              <span>${escapeHtml(tr("popup.relatedNote"))}</span>
            </div>
            <div class="related-list">
              ${metrics.related
                .map(
                  (item) => `
                    <div class="related-row">
                      <span title="${escapeHtml(item.keyword)}">${escapeHtml(item.keyword)}</span>
                      <strong>${formatVolume(item.volume)}</strong>
                      <em>${item.competition}</em>
                    </div>
                  `
                )
                .join("")}
            </div>
          </div>`
        : ""
    }
  `;

  els.analysisContent.querySelector('[data-action="save"]')?.addEventListener("click", saveCurrent);
  els.analysisContent.querySelector('[data-action="copy"]')?.addEventListener("click", copyCurrent);
  els.analysisContent.querySelector('[data-action="trial"]')?.addEventListener("click", startTrial);
  refreshIcons();
}

function difficultyCopy(score) {
  if (score >= 75) return tr("common.difficultyHard");
  if (score >= 55) return tr("common.difficultyMedium");
  if (score >= 35) return tr("common.difficultyLow");
  return tr("common.difficultyEasy");
}

function formatMonth(month) {
  const value = Number(month);
  if (!value) return "";
  return new Date(2026, value - 1, 1).toLocaleDateString(
    currentLanguage() === "zh" ? "zh-CN" : "en-US",
    { month: currentLanguage() === "zh" ? "numeric" : "short" }
  );
}

async function analyzeCurrentInput() {
  const keyword = els.keywordInput.value.trim();
  if (!keyword) {
    els.keywordInput.focus();
    return;
  }
  els.analyzeButton.disabled = true;
  renderLoading();
  try {
    const result = await send("ANALYZE_KEYWORD", {
      keyword,
      country: els.countrySelect.value,
      addHistory: true
    });
    state = await send("GET_STATE");
    renderShell();
    renderMetrics(result.metrics, result.plan);
    if (result.fallbackReason) {
      showToast(tr("popup.estimateFallback", { reason: result.fallbackReason }));
    }
  } catch (error) {
    renderError(
      error.code === "QUOTA_EXCEEDED"
        ? tr("popup.errorQuota")
        : localizeError(error)
    );
  } finally {
    els.analyzeButton.disabled = false;
  }
}

async function saveCurrent() {
  if (!currentMetrics) return;
  try {
    const result = await send("SAVE_KEYWORD", { metrics: currentMetrics });
    state.saved = result.saved;
    renderShell();
    renderMetrics(currentMetrics, state.plan);
    showToast(tr("popup.savedToast"));
  } catch (error) {
    showToast(localizeError(error));
  }
}

async function copyCurrent() {
  if (!currentMetrics) return;
  const metrics = currentMetrics;
  const countryName = tr(`common.country.${metrics.country}`);
  const volumeBand = tr(`common.volumeBand.${metrics.volumeBand.key}`);
  const competitionBand = tr(`common.competitionBand.${metrics.competitionBand.key}`);
  const opportunityBand =
    metrics.opportunityBand ||
    (metrics.opportunity >= 75
      ? "strong"
      : metrics.opportunity >= 58
        ? "test"
        : metrics.opportunity >= 40
          ? "differentiate"
          : "cautious");
  const opportunityLabel = tr(`common.opportunityBand.${opportunityBand}`);
  const intentLabel = tr(`common.intent.${metrics.intent}`);
  const sourceLabel = tr(`common.source.${metrics.source}`);
  const brief = [
    `${metrics.keyword} · ${countryName}`,
    tr("popup.briefVolume", {
      volume: formatVolume(metrics.volume),
      band: volumeBand,
      source: sourceLabel
    }),
    tr("popup.briefCompetition", { score: metrics.competition, band: competitionBand }),
    tr("popup.briefCpc", { value: formatCurrency(metrics.cpc) }),
    tr("popup.briefOpportunity", { score: metrics.opportunity, band: opportunityLabel }),
    tr("popup.briefIntent", { intent: intentLabel, difficulty: metrics.difficulty })
  ].join("\n");
  try {
    await navigator.clipboard.writeText(brief);
    showToast(tr("popup.copyToast"));
  } catch {
    showToast(tr("popup.copyFailed"));
  }
}

function renderSaved() {
  els.savedCount.textContent = String(state.saved.length);
  els.savedMeta.textContent =
    state.plan === "pro"
      ? tr("popup.savedProMeta", { count: state.saved.length })
      : tr("popup.savedFreeMeta", {
          count: state.saved.length,
          limit: state.limits.freeSaved
        });

  if (!state.saved.length) {
    els.savedContent.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon"><i data-lucide="bookmark"></i></span>
        <h3>${escapeHtml(tr("popup.savedEmptyTitle"))}</h3>
        <p>${escapeHtml(tr("popup.savedEmptyDesc"))}</p>
      </div>
    `;
    refreshIcons();
    return;
  }

  els.savedContent.innerHTML = `
    <div class="saved-list">
      ${state.saved
        .map(
          (item) => `
            <div class="saved-item">
              <div class="saved-main">
                <div class="saved-keyword" title="${escapeHtml(item.keyword)}">${escapeHtml(item.keyword)}</div>
                <div class="saved-meta">${escapeHtml(tr("popup.savedItemMeta", {
                  volume: formatVolume(item.volume),
                  competition: item.competition,
                  country: item.country
                }))}</div>
              </div>
              <div class="saved-actions">
                <button class="row-icon-button" type="button" title="${escapeHtml(tr("popup.reanalyze"))}" data-analyze="${escapeHtml(item.keyword)}">
                  <i data-lucide="scan-search"></i>
                </button>
                <button class="row-icon-button" type="button" title="${escapeHtml(tr("popup.remove"))}" data-remove="${escapeHtml(item.keyword)}" data-country="${item.country}" data-danger="true">
                  <i data-lucide="trash-2"></i>
                </button>
              </div>
            </div>
          `
        )
        .join("")}
    </div>
  `;

  els.savedContent.querySelectorAll("[data-analyze]").forEach((button) => {
    button.addEventListener("click", () => {
      switchView("analysis");
      els.keywordInput.value = button.dataset.analyze;
      analyzeCurrentInput();
    });
  });
  els.savedContent.querySelectorAll("[data-remove]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        const result = await send("REMOVE_SAVED", {
          keyword: button.dataset.remove,
          country: button.dataset.country
        });
        state.saved = result.saved;
        renderSaved();
        if (currentMetrics) renderMetrics(currentMetrics, state.plan);
        showToast(tr("popup.removedToast"));
      } catch (error) {
        showToast(localizeError(error));
      }
    });
  });
  refreshIcons();
}

function renderHistory() {
  if (!state.history.length) {
    els.historyContent.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon"><i data-lucide="history"></i></span>
        <h3>${escapeHtml(tr("popup.historyEmptyTitle"))}</h3>
        <p>${escapeHtml(tr("popup.historyEmptyDesc"))}</p>
      </div>
    `;
    refreshIcons();
    return;
  }

  els.historyContent.innerHTML = `
    <div class="history-list">
      ${state.history
        .slice(0, 12)
        .map(
          (item) => `
            <button class="history-item" type="button" data-analyze="${escapeHtml(item.keyword)}">
              <span class="history-main">
                <span class="history-keyword">${escapeHtml(item.keyword)}</span>
                <span class="history-meta">${item.country} · ${escapeHtml(timeAgo(item.analyzedAt))} · ${escapeHtml(item.source === "dataforseo" ? tr("common.exactData") : tr("common.localEstimate"))}</span>
              </span>
              <span class="history-values">
                <strong>${formatVolume(item.volume)}</strong>
                KD ${item.competition}
              </span>
            </button>
          `
        )
        .join("")}
    </div>
  `;
  els.historyContent.querySelectorAll("[data-analyze]").forEach((button) => {
    button.addEventListener("click", () => {
      switchView("analysis");
      els.keywordInput.value = button.dataset.analyze;
      analyzeCurrentInput();
    });
  });
  refreshIcons();
}

function timeAgo(isoDate) {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.max(0, Math.round(diff / 60000));
  if (minutes < 1) return tr("popup.timeJustNow");
  if (minutes < 60) return tr("popup.timeMinutes", { count: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return tr("popup.timeHours", { count: hours });
  return tr("popup.timeDays", { count: Math.round(hours / 24) });
}

function renderShell() {
  const isPro = state.plan === "pro";
  applyLanguage();
  els.planBadge.textContent = isPro ? tr("common.pro") : tr("common.free");
  els.planBadge.dataset.plan = state.plan;
  els.quotaBar.hidden = isPro;
  els.upgradeFooter.hidden = isPro;
  const canStartTrial = !isPro && !state.trialUsed;
  els.trialButton.disabled = !canStartTrial;
  els.trialInlineButton.disabled = !canStartTrial;
  els.trialButton.textContent = canStartTrial ? tr("popup.trialDays") : tr("popup.usedBadge");
  els.trialInlineButton.textContent = canStartTrial
    ? tr("popup.freeTrial")
    : tr("popup.trialEnded");
  if (!isPro) {
    const { used, limit, remaining } = state.quota;
    els.quotaText.textContent = tr("popup.quotaLine", { remaining, limit, used });
    els.quotaFill.style.width = `${Math.min(100, (used / limit) * 100)}%`;
  }
  renderSaved();
  renderHistory();
}

function switchView(view) {
  activeView = view;
  document.querySelectorAll(".view-tab").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === view);
  });
  document.querySelectorAll(".view-panel").forEach((panel) => {
    panel.classList.toggle("is-active", panel.id === `${view}View`);
  });
  if (view === "saved") renderSaved();
  if (view === "history") renderHistory();
}

async function startTrial() {
  try {
    state = await send("START_TRIAL");
    renderShell();
    if (currentMetrics) renderMetrics(currentMetrics, state.plan);
    showToast(tr("popup.trialToast"));
  } catch (error) {
    showToast(localizeError(error));
  }
}

async function toggleLanguage() {
  try {
    const languagePreference = nextLanguagePreference(state.settings.language);
    state = await send("UPDATE_SETTINGS", { language: languagePreference });
    els.toast.classList.remove("is-visible");
    renderShell();
    if (currentMetrics) {
      renderMetrics(currentMetrics, state.plan);
    } else {
      renderEmptyAnalysis();
    }
  } catch (error) {
    showToast(localizeError(error));
  }
}

function toCsv(rows) {
  const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [
    ["keyword", "country", "volume", "competition", "difficulty", "cpc", "opportunity", "source"],
    ...rows.map((item) => [
      item.keyword,
      item.country,
      item.volume,
      item.competition,
      item.difficulty,
      item.cpc,
      item.opportunity,
      item.source
    ])
  ]
    .map((row) => row.map(escape).join(","))
    .join("\n");
}

async function exportSaved() {
  if (state.plan !== "pro") {
    showToast(tr("popup.exportProOnly"));
    return;
  }
  if (!state.saved.length) {
    showToast(tr("popup.exportEmpty"));
    return;
  }
  const blob = new Blob([`\ufeff${toCsv(state.saved)}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `seoanalysis-keywords-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  showToast(tr("popup.exportDone", { count: state.saved.length }));
}

function bindEvents() {
  els.searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    switchView("analysis");
    analyzeCurrentInput();
  });
  els.countrySelect.addEventListener("change", async () => {
    try {
      state = await send("UPDATE_SETTINGS", { country: els.countrySelect.value });
      if (els.keywordInput.value.trim()) analyzeCurrentInput();
    } catch (error) {
      showToast(localizeError(error));
    }
  });
  document.querySelectorAll(".view-tab").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });
  els.languageButton.addEventListener("click", toggleLanguage);
  els.settingsButton.addEventListener("click", () => chrome.runtime.openOptionsPage());
  els.openOptionsButton.addEventListener("click", () => chrome.runtime.openOptionsPage());
  els.trialButton.addEventListener("click", startTrial);
  els.trialInlineButton.addEventListener("click", startTrial);
  els.exportButton.addEventListener("click", exportSaved);
}

async function initialize() {
  populateCountries();
  bindEvents();
  try {
    state = await send("GET_STATE");
    els.countrySelect.value = state.settings.country;
    renderShell();

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    let query = "";
    try {
      const url = new URL(tab?.url || "");
      if (url.hostname.startsWith("www.google.") && url.pathname === "/search") {
        query = url.searchParams.get("q") || "";
      }
    } catch {
      query = "";
    }

    if (query) {
      els.keywordInput.value = query;
      const cached = await send("GET_METRICS", {
        keyword: query,
        country: state.settings.country,
        allowQuota: false
      });
      renderMetrics(cached.metrics, cached.plan);
    } else {
      renderEmptyAnalysis();
    }
  } catch (error) {
    renderError(localizeError(error));
  }
  refreshIcons();
}

initialize();

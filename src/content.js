(() => {
  const HOST_ID = "seoanalysis-serp-root";
  const GOOGLE_HOST = location.hostname;
  let lastQuery = "";
  let currentMetrics = null;
  let state = null;
  let collapsed = false;
  let renderToken = 0;
  let language = "en";
  let i18n = null;
  const i18nReady = import(chrome.runtime.getURL("src/i18n.js"))
    .then((module) => {
      i18n = module;
      return module;
    })
    .catch(() => null);

  function tr(key, params = {}) {
    return i18n?.t(language, key, params) ?? key;
  }

  function localizeError(error) {
    return i18n?.translateError(error, language) ?? error?.message ?? "";
  }

  const icons = {
    logo: `
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="currentColor"/>
        <circle cx="14" cy="14" r="6.4" fill="none" stroke="#fff" stroke-width="2.7"/>
        <path d="m19 19 5.2 5.2" stroke="#f3a39a" stroke-width="3" stroke-linecap="round"/>
        <path d="M11 16v-2.2M14 16v-4.1M17 16v-5" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>
      </svg>`,
    sparkles: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m12 3 1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3Z"/>
        <path d="m19 14 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14Z"/>
      </svg>`,
    save: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/>
        <path d="M17 21v-8H7v8M7 3v5h8"/>
      </svg>`,
    open: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
      </svg>`,
    lock: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect width="18" height="11" x="3" y="11" rx="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>`,
    chevron: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m6 9 6 6 6-6"/>
      </svg>`,
    close: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M18 6 6 18M6 6l12 12"/>
      </svg>`,
    trend: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m3 17 6-6 4 4 8-8"/>
        <path d="M15 7h6v6"/>
      </svg>`
  };

  function formatVolume(volume) {
    if (volume >= 1000000) return `${(volume / 1000000).toFixed(volume >= 10000000 ? 0 : 1)}M`;
    if (volume >= 1000) return `${(volume / 1000).toFixed(volume >= 10000 ? 0 : 1)}K`;
    return String(Math.round(volume));
  }

  function formatCpc(value) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  function queryFromPage() {
    try {
      const url = new URL(location.href);
      const fromUrl = url.searchParams.get("q");
      if (fromUrl) return fromUrl.replace(/\+/g, " ").trim();
    } catch {
      // Fall back to the search field below.
    }
    const field = document.querySelector('textarea[name="q"], input[name="q"]');
    return field?.value?.trim() || "";
  }

  function buildSparkline(trend) {
    const values = trend.map((item) => item.value);
    const max = Math.max(...values, 1);
    const min = Math.min(...values);
    const width = 182;
    const height = 42;
    const points = values
      .map((value, index) => {
        const x = (index / Math.max(1, values.length - 1)) * width;
        const normalized = max === min ? 0.5 : (value - min) / (max - min);
        const y = height - 5 - normalized * (height - 10);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
    const area = `0,${height} ${points} ${width},${height}`;
    return `
      <svg class="sparkline" viewBox="0 0 ${width} ${height}" aria-label="${escapeHtml(tr("common.trend12"))}">
        <polygon points="${area}" fill="rgba(197,47,61,.10)"></polygon>
        <polyline points="${points}" fill="none" stroke="#c52f3d" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></polyline>
      </svg>
    `;
  }

  function styles() {
    return `
      :host {
        all: initial;
        display: block;
        width: 100%;
        color-scheme: light;
      }
      * { box-sizing: border-box; }
      button { font: inherit; }
      .shell {
        --ink: #27191c;
        --muted: #75656a;
        --soft: #fbf0f1;
        --line: #eadadd;
        --brand: #c52f3d;
        --brand-ink: #8b1827;
        --accent: #ad4a2d;
        --accent-soft: #fff5ee;
        --danger: #961c25;
        width: 100%;
        max-width: 652px;
        margin: 10px 0 18px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
          "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
        font-size: 13px;
        line-height: 1.45;
        color: var(--ink);
        background: #fff;
        border: 1px solid var(--line);
        border-radius: 8px;
        box-shadow: 0 4px 15px rgba(72, 28, 37, 0.075);
        overflow: hidden;
      }
      .shell[data-state="error"] { border-color: #ead4d1; }
      .topbar {
        display: flex;
        align-items: center;
        gap: 9px;
        min-height: 42px;
        padding: 8px 10px 8px 12px;
        border-bottom: 1px solid var(--line);
        background: #fffafa;
      }
      .brand {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        font-size: 12px;
        font-weight: 720;
        letter-spacing: 0;
        color: var(--ink);
        white-space: nowrap;
      }
      .brand svg { width: 22px; height: 22px; color: var(--brand); }
      .plan {
        padding: 2px 6px;
        border: 1px solid #e7d1d4;
        border-radius: 4px;
        font-size: 9px;
        font-weight: 800;
        line-height: 1.4;
        color: var(--brand-ink);
        background: #fff4f5;
      }
      .plan[data-plan="pro"] {
        border-color: #efd1ad;
        color: #8b4b0d;
        background: var(--accent-soft);
      }
      .query {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-weight: 650;
        color: #4f3439;
      }
      .spacer { flex: 1; }
      .icon-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        padding: 0;
        border: 0;
        border-radius: 5px;
        color: #75656a;
        background: transparent;
        cursor: pointer;
      }
      .icon-button:hover { background: #fbf0f1; color: var(--ink); }
      .icon-button svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
      .body { padding: 12px; }
      .metrics {
        display: grid;
        grid-template-columns: 1.25fr repeat(3, 1fr);
        gap: 0;
      }
      .metric {
        min-width: 0;
        padding: 1px 13px;
        border-left: 1px solid var(--line);
      }
      .metric:first-child { padding-left: 0; border-left: 0; }
      .metric-label {
        display: flex;
        align-items: center;
        gap: 5px;
        margin-bottom: 4px;
        font-size: 10px;
        font-weight: 650;
        color: var(--muted);
      }
      .metric-value {
        display: flex;
        align-items: baseline;
        gap: 5px;
        min-height: 25px;
        font-size: 21px;
        font-weight: 760;
        letter-spacing: 0;
        font-variant-numeric: tabular-nums;
      }
      .metric-unit { font-size: 10px; font-weight: 550; color: var(--muted); }
      .band {
        display: inline-block;
        margin-top: 1px;
        font-size: 10px;
        font-weight: 650;
      }
      .band[data-key="hard"], .band[data-key="very-high"] { color: var(--danger); }
      .band[data-key="high"] { color: #b05e16; }
      .band[data-key="medium"] { color: var(--brand-ink); }
      .band[data-key="low"], .band[data-key="micro"] { color: #8f4d59; }
      .primary-value { color: var(--brand-ink); }
      .opportunity { color: #8c500f; }
      .bar {
        height: 4px;
        margin-top: 5px;
        overflow: hidden;
        border-radius: 2px;
        background: #f1e0e3;
      }
      .bar > span {
        display: block;
        height: 100%;
        border-radius: inherit;
        background: var(--brand);
      }
      .bar > span[data-level="high"] { background: #c86f20; }
      .bar > span[data-level="hard"] { background: #bd4f44; }
      .footer {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 9px 12px;
        border-top: 1px solid var(--line);
        background: #fffbfb;
      }
      .source {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        min-width: 0;
        font-size: 10px;
        color: var(--muted);
        white-space: nowrap;
      }
      .source-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--brand);
      }
      .source[data-exact="false"] .source-dot { background: var(--accent); }
      .footer-spacer { flex: 1; }
      .text-button {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        height: 28px;
        padding: 0 8px;
        border: 1px solid var(--line);
        border-radius: 5px;
        font-size: 11px;
        font-weight: 650;
        color: #4f3439;
        background: #fff;
        cursor: pointer;
      }
      .text-button:hover { border-color: #d5b1b7; background: #fff9f9; }
      .text-button.primary {
        border-color: var(--brand);
        color: #fff;
        background: var(--brand);
      }
      .text-button.primary:hover { background: var(--brand-ink); }
      .text-button svg { width: 13px; height: 13px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
      .details {
        display: grid;
        grid-template-columns: 190px 1fr;
        gap: 14px;
        padding: 11px 12px 12px;
        border-top: 1px solid var(--line);
        background: #fff8f9;
      }
      .details.single { grid-template-columns: 1fr; }
      .details.single .trend-box { padding-right: 0; border-right: 0; }
      .trend-box {
        min-width: 0;
        padding-right: 14px;
        border-right: 1px solid var(--line);
      }
      .detail-title {
        display: flex;
        align-items: center;
        gap: 5px;
        margin-bottom: 3px;
        font-size: 10px;
        font-weight: 700;
        color: var(--muted);
      }
      .detail-title svg { width: 12px; height: 12px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
      .sparkline { width: 100%; height: 42px; overflow: visible; }
      .related-title { margin-bottom: 6px; }
      .chips { display: flex; flex-wrap: wrap; gap: 5px; }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 4px 6px;
        border: 1px solid #eadadd;
        border-radius: 4px;
        font-size: 10px;
        color: #4f3439;
        background: #fff;
      }
      .chip strong { color: var(--brand-ink); font-variant-numeric: tabular-nums; }
      .locked {
        position: relative;
        display: flex;
        align-items: center;
        gap: 7px;
        min-height: 52px;
        padding: 9px;
        border: 1px dashed #e1c7c1;
        border-radius: 5px;
        color: #6d5a46;
        background: #fff8f6;
      }
      .locked svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; }
      .locked strong { display: block; font-size: 11px; color: #5b432a; }
      .locked span { display: block; margin-top: 1px; font-size: 10px; }
      .locked button {
        margin-left: auto;
        padding: 4px 7px;
        border: 1px solid #e2c0b8;
        border-radius: 4px;
        flex: 0 0 auto;
        white-space: nowrap;
        font-size: 10px;
        font-weight: 700;
        color: #87500f;
        background: #fff1ed;
        cursor: pointer;
      }
      .message {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 67px;
        padding: 13px;
        font-size: 12px;
        color: var(--muted);
      }
      .loader {
        width: 15px;
        height: 15px;
        border: 2px solid #efdadd;
        border-top-color: var(--brand);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin { to { transform: rotate(360deg); } }
      .notice {
        padding: 8px 12px;
        border-bottom: 1px solid #efd7d2;
        font-size: 10px;
        color: #7b5427;
        background: #fff7f3;
      }
      .shell[data-compact="true"] .footer .optional { display: none; }
      .shell[data-compact="true"] .details { display: none; }
      @media (max-width: 620px) {
        .metrics { grid-template-columns: repeat(2, 1fr); row-gap: 12px; }
        .metric:nth-child(3) { border-left: 0; padding-left: 0; }
        .details { grid-template-columns: 1fr; }
        .trend-box { border-right: 0; padding-right: 0; }
        .query { max-width: 160px; }
      }
      @media (prefers-reduced-motion: reduce) {
        .loader { animation-duration: 2s; }
      }
    `;
  }

  function logoMarkup() {
    return icons.logo;
  }

  function createRoot() {
    let host = document.getElementById(HOST_ID);
    if (host) return host;
    host = document.createElement("div");
    host.id = HOST_ID;
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `<style>${styles()}</style><div class="mount"></div>`;
    return host;
  }

  function mountRoot(host) {
    const search = document.querySelector("#search");
    const center = document.querySelector("#center_col") || search?.parentElement;
    if (!center || !search) return false;
    if (host.parentElement === center && host.nextElementSibling === search) return true;
    center.insertBefore(host, search);
    return true;
  }

  function getShadow(host) {
    return host.shadowRoot || host.attachShadow({ mode: "open" });
  }

  function renderLoading(host, query) {
    const shadow = getShadow(host);
    const mount = shadow.querySelector(".mount");
    if (!mount) return;
    mount.innerHTML = `
      <section class="shell" data-state="loading">
        <div class="topbar">
          <span class="brand"><span>${logoMarkup()}</span>SEOanalysis</span>
          <span class="plan" data-plan="free">${escapeHtml(tr("common.free"))}</span>
          <span class="query">${escapeHtml(query)}</span>
          <span class="spacer"></span>
        </div>
        <div class="message"><span class="loader"></span><span>${escapeHtml(tr("content.loading"))}</span></div>
      </section>
    `;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function renderError(host, query, message) {
    const shadow = getShadow(host);
    const mount = shadow.querySelector(".mount");
    if (!mount) return;
    mount.innerHTML = `
      <section class="shell" data-state="error">
        <div class="topbar">
          <span class="brand"><span>${logoMarkup()}</span>SEOanalysis</span>
          <span class="plan" data-plan="free">${escapeHtml(tr("common.free"))}</span>
          <span class="query">${escapeHtml(query)}</span>
          <span class="spacer"></span>
          <button class="icon-button" data-action="close" title="${escapeHtml(tr("common.close"))}">${icons.close}</button>
        </div>
        <div class="message">${escapeHtml(message)}</div>
      </section>
    `;
    mount.querySelector('[data-action="close"]')?.addEventListener("click", () => host.remove());
  }

  function competitionLevel(competition) {
    if (competition >= 75) return "hard";
    if (competition >= 55) return "high";
    return "low";
  }

  function detailsMarkup(metrics, plan, showRelated) {
    if (plan !== "pro") {
      return `
        <section class="details${showRelated ? "" : " single"}">
          <div class="trend-box">
            <div class="detail-title">${icons.trend} ${escapeHtml(tr("common.trend12"))}</div>
            <div class="locked">
              ${icons.lock}
              <div><strong>${escapeHtml(tr("content.proTrendTitle"))}</strong><span>${escapeHtml(tr("content.proTrendDesc"))}</span></div>
              <button data-action="upgrade">${escapeHtml(tr("common.unlock"))}</button>
            </div>
          </div>
          ${
            showRelated
              ? `<div>
                  <div class="detail-title related-title">${icons.sparkles} ${escapeHtml(tr("common.relatedOpportunities"))}</div>
                  <div class="locked">
                    ${icons.lock}
                    <div><strong>${escapeHtml(tr("content.relatedLockedTitle"))}</strong><span>${escapeHtml(tr("content.relatedLockedDesc"))}</span></div>
                    <button data-action="upgrade">${escapeHtml(tr("common.pro"))}</button>
                  </div>
                </div>`
              : ""
          }
        </section>
      `;
    }

    return `
      <section class="details${showRelated ? "" : " single"}">
        <div class="trend-box">
          <div class="detail-title">${icons.trend} ${escapeHtml(tr("common.trend12"))}</div>
          ${buildSparkline(metrics.trend)}
        </div>
        ${
          showRelated
            ? `<div>
                <div class="detail-title related-title">${icons.sparkles} ${escapeHtml(tr("common.relatedOpportunities"))}</div>
                <div class="chips">
                  ${metrics.related
                    .slice(0, 5)
                    .map(
                      (item) =>
                        `<span class="chip">${escapeHtml(item.keyword)} <strong>${formatVolume(item.volume)}</strong></span>`
                    )
                    .join("")}
                </div>
              </div>`
            : ""
        }
      </section>
    `;
  }

  function renderMetrics(host, metrics, plan, quota, fallbackReason) {
    const shadow = getShadow(host);
    const mount = shadow.querySelector(".mount");
    if (!mount) return;
    const competitionTone = competitionLevel(metrics.competition);
    const compact = Boolean(state?.settings?.compactSerp);
    const quotaLabel =
      plan === "pro"
        ? tr("common.unlimited")
        : tr("common.remainingToday", {
            remaining: quota?.remaining ?? 0,
            limit: quota?.limit ?? 30
          });
    const countryName = tr(`common.country.${metrics.country}`);
    const planName = plan === "pro" ? tr("common.pro") : tr("common.free");
    const opportunityBand =
      metrics.opportunityBand ||
      (metrics.opportunity >= 75
        ? "strong"
        : metrics.opportunity >= 58
          ? "test"
          : metrics.opportunity >= 40
            ? "differentiate"
            : "cautious");

    mount.innerHTML = `
      <section class="shell" data-state="ready" data-compact="${compact}">
        <div class="topbar">
          <span class="brand"><span>${logoMarkup()}</span>SEOanalysis</span>
          <span class="plan" data-plan="${plan}">${planName}</span>
          <span class="query" title="${escapeHtml(metrics.keyword)}">${escapeHtml(metrics.keyword)}</span>
          <span class="spacer"></span>
          <button class="icon-button" data-action="toggle-details" title="${escapeHtml(tr("common.expand"))}">${icons.chevron}</button>
          <button class="icon-button" data-action="close" title="${escapeHtml(tr("common.close"))}">${icons.close}</button>
        </div>
        ${
          fallbackReason
            ? `<div class="notice">${escapeHtml(tr("content.fallbackNotice", { reason: fallbackReason }))}</div>`
            : ""
        }
        <div class="body">
          <div class="metrics">
            <div class="metric">
              <div class="metric-label">${escapeHtml(tr("common.monthlyVolume"))} <span class="metric-unit">${escapeHtml(countryName)}</span></div>
              <div class="metric-value primary-value">${formatVolume(metrics.volume)} <span class="band" data-key="${metrics.volumeBand.key}">${escapeHtml(tr(`common.volumeBand.${metrics.volumeBand.key}`))}</span></div>
              <div class="bar"><span style="width:${Math.min(100, Math.max(9, Math.log10(metrics.volume + 1) * 18))}%"></span></div>
            </div>
            <div class="metric">
              <div class="metric-label">${escapeHtml(tr("common.competition"))}</div>
              <div class="metric-value">${metrics.competition}<span class="metric-unit">/100</span></div>
              <div class="bar"><span data-level="${competitionTone}" style="width:${metrics.competition}%"></span></div>
            </div>
            <div class="metric">
              <div class="metric-label">${escapeHtml(tr("common.cpc"))}</div>
              <div class="metric-value">${formatCpc(metrics.cpc)}</div>
              <div class="band">${escapeHtml(metrics.exact ? tr("common.cpcBidMedian") : tr("common.localEstimate"))}</div>
            </div>
            <div class="metric">
              <div class="metric-label">${escapeHtml(tr("common.opportunity"))}</div>
              <div class="metric-value opportunity">${metrics.opportunity}<span class="metric-unit">/100</span></div>
              <div class="band">${escapeHtml(tr(`common.opportunityBand.${opportunityBand}`))}</div>
            </div>
          </div>
        </div>
        ${detailsMarkup(metrics, plan, state?.settings?.showRelated !== false)}
        <div class="footer">
          <span class="source" data-exact="${metrics.exact}">
            <span class="source-dot"></span>${escapeHtml(tr(`common.source.${metrics.source}`))} · ${metrics.country}
          </span>
          <span class="optional source">${escapeHtml(quotaLabel)}</span>
          <span class="footer-spacer"></span>
          <button class="text-button optional" data-action="save">${icons.save} ${escapeHtml(tr("common.save"))}</button>
          <button class="text-button primary" data-action="open">${icons.open} ${escapeHtml(tr("common.workspace"))}</button>
        </div>
      </section>
    `;

    mount.querySelector('[data-action="close"]')?.addEventListener("click", () => host.remove());
    mount.querySelector('[data-action="toggle-details"]')?.addEventListener("click", () => {
      collapsed = !collapsed;
      const details = mount.querySelector(".details");
      if (details) details.style.display = collapsed ? "none" : "";
      const button = mount.querySelector('[data-action="toggle-details"]');
      if (button) button.style.transform = collapsed ? "rotate(180deg)" : "";
    });
    mount.querySelectorAll('[data-action="upgrade"]').forEach((button) => {
      button.addEventListener("click", () => openWorkspace());
    });
    mount.querySelector('[data-action="open"]')?.addEventListener("click", () => openWorkspace());
    mount.querySelector('[data-action="save"]')?.addEventListener("click", async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      button.innerHTML = `${icons.save} ${escapeHtml(tr("common.saved"))}`;
      try {
        const response = await chrome.runtime.sendMessage({
          type: "SAVE_KEYWORD",
          payload: { metrics: currentMetrics }
        });
        if (!response?.ok) {
          const error = new Error(response?.error?.message || "Save failed");
          error.code = response?.error?.code;
          throw error;
        }
        button.innerHTML = `${icons.save} ${escapeHtml(tr("common.saved"))}`;
      } catch (error) {
        button.innerHTML = `${icons.save} ${escapeHtml(tr("common.saveFailed"))}`;
        button.title = localizeError(error);
      }
    });
  }

  async function openWorkspace() {
    try {
      await chrome.runtime.sendMessage({ type: "OPEN_POPUP" });
    } catch {
      location.href = `https://www.google.com/search?q=${encodeURIComponent(lastQuery)}`;
    }
  }

  function isGoogleSearchPage() {
    return (
      GOOGLE_HOST.startsWith("www.google.") &&
      location.pathname === "/search" &&
      Boolean(queryFromPage())
    );
  }

  async function update() {
    await i18nReady;
    if (!isGoogleSearchPage()) {
      document.getElementById(HOST_ID)?.remove();
      return;
    }

    const query = queryFromPage();
    if (!query) return;
    const token = ++renderToken;
    const host = createRoot();

    const stateResponse = await chrome.runtime.sendMessage({ type: "GET_STATE" });
    if (!stateResponse?.ok) return;
    state = stateResponse.result;
    language = i18n?.resolveLanguage(state.settings.language) ?? "en";
    if (!state.settings.enabled) {
      host.remove();
      return;
    }
    if (!mountRoot(host)) return;

    if (query === lastQuery && currentMetrics) return;
    lastQuery = query;
    renderLoading(host, query);

    try {
      const response = await chrome.runtime.sendMessage({
        type: "ANALYZE_KEYWORD",
        payload: { keyword: query, country: state.settings.country, addHistory: true }
      });
      if (token !== renderToken) return;
      if (!response?.ok) {
        const message =
          response?.error?.code === "QUOTA_EXCEEDED"
            ? tr("content.errorQuota")
            : localizeError({
                ...response?.error,
                message: response?.error?.message || tr("content.errorGeneric")
              });
        renderError(host, query, message);
        return;
      }
      currentMetrics = response.result.metrics;
      renderMetrics(
        host,
        currentMetrics,
        response.result.plan,
        response.result.quota,
        response.result.fallbackReason
      );
    } catch (error) {
      if (token === renderToken) renderError(host, query, localizeError(error));
    }
  }

  let lastUrl = location.href;
  function scheduleUpdate() {
    window.setTimeout(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        lastQuery = "";
        currentMetrics = null;
        collapsed = false;
      }
      update();
    }, 320);
  }

  const observer = new MutationObserver(() => {
    if (isGoogleSearchPage() && !document.getElementById(HOST_ID)) scheduleUpdate();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("popstate", scheduleUpdate);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleUpdate, { once: true });
  } else {
    scheduleUpdate();
  }
})();

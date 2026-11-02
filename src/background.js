import {
  COUNTRIES,
  estimateKeyword,
  mapDataForSeoResult
} from "./engine.js";

const FREE_DAILY_LIMIT = 30;
const FREE_SAVE_LIMIT = 20;
const PRO_TRIAL_DAYS = 7;
const HISTORY_LIMIT = 80;
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

const DEFAULT_SETTINGS = {
  enabled: true,
  language: "auto",
  country: "US",
  dataSource: "local",
  compactSerp: false,
  showRelated: true,
  dataForSeoLogin: "",
  dataForSeoPassword: ""
};

const DEFAULT_ACCOUNT = {
  plan: "free",
  trialEndsAt: null,
  trialUsed: false,
  saved: [],
  history: [],
  quota: {
    date: todayKey(),
    used: 0,
    keys: []
  }
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function effectivePlan(account) {
  if (account.plan === "pro") {
    if (!account.trialEndsAt) return "pro";
    if (new Date(account.trialEndsAt).getTime() > Date.now()) return "pro";
  }
  return "free";
}

async function getLocal(keys) {
  return chrome.storage.local.get(keys);
}

async function setLocal(values) {
  return chrome.storage.local.set(values);
}

async function getSettings() {
  const stored = await getLocal("settings");
  return { ...DEFAULT_SETTINGS, ...(stored.settings || {}) };
}

async function getAccount() {
  const stored = await getLocal("account");
  const account = {
    ...DEFAULT_ACCOUNT,
    ...(stored.account || {}),
    quota: {
      ...DEFAULT_ACCOUNT.quota,
      ...(stored.account?.quota || {}),
      keys: [...(stored.account?.quota?.keys || [])]
    }
  };

  if (account.quota.date !== todayKey()) {
    account.quota = { date: todayKey(), used: 0, keys: [] };
    await setLocal({ account });
  }

  return account;
}

async function saveAccount(account) {
  await setLocal({ account });
  return account;
}

function publicState(settings, account) {
  const plan = effectivePlan(account);
  const limit = plan === "pro" ? null : FREE_DAILY_LIMIT;
  return {
    plan,
    trialEndsAt: account.trialEndsAt,
    trialUsed: Boolean(account.trialUsed),
    settings: {
      ...settings,
      dataForSeoLogin: settings.dataForSeoLogin ? "configured" : "",
      dataForSeoPassword: settings.dataForSeoPassword ? "configured" : ""
    },
    saved: account.saved,
    history: account.history,
    quota: {
      used: plan === "pro" ? 0 : account.quota.used,
      limit,
      remaining: plan === "pro" ? null : Math.max(0, FREE_DAILY_LIMIT - account.quota.used)
    },
    limits: {
      freeDaily: FREE_DAILY_LIMIT,
      freeSaved: FREE_SAVE_LIMIT
    }
  };
}

async function consumeQuota(account, plan, usageKey) {
  if (plan === "pro") return;
  if (account.quota.keys.includes(usageKey)) return;
  if (account.quota.used >= FREE_DAILY_LIMIT) {
    const error = new Error("今日免费分析次数已用完");
    error.code = "QUOTA_EXCEEDED";
    throw error;
  }
  account.quota.used += 1;
  account.quota.keys.push(usageKey);
  await saveAccount(account);
}

function cacheKey(keyword, country, dataSource) {
  return `${dataSource}:${country}:${keyword}`;
}

async function readCache(key) {
  const { metricCache = {} } = await getLocal("metricCache");
  const hit = metricCache[key];
  if (!hit || Date.now() - new Date(hit.updatedAt).getTime() > CACHE_TTL_MS) {
    return null;
  }
  return hit;
}

async function writeCache(key, value) {
  const { metricCache = {} } = await getLocal("metricCache");
  const next = { ...metricCache, [key]: value };
  const cutoff = Date.now() - CACHE_TTL_MS;
  for (const [entryKey, entry] of Object.entries(next)) {
    if (new Date(entry.updatedAt).getTime() < cutoff) delete next[entryKey];
  }
  await setLocal({ metricCache: next });
}

async function fetchDataForSeo(keyword, countryCode, settings) {
  if (!settings.dataForSeoLogin || !settings.dataForSeoPassword) {
    const error = new Error("请先在设置中填写 DataForSEO 凭据");
    error.code = "MISSING_CREDENTIALS";
    throw error;
  }

  const country = COUNTRIES[countryCode] || COUNTRIES.US;
  const authorization = `Basic ${btoa(`${settings.dataForSeoLogin}:${settings.dataForSeoPassword}`)}`;
  const response = await fetch(
    "https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live",
    {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json"
      },
      body: JSON.stringify([
        {
          keywords: [keyword],
          location_name: country.locationName,
          language_name: country.language,
          include_adult_keywords: false
        }
      ])
    }
  );

  if (!response.ok) {
    const error = new Error(`DataForSEO 请求失败 (${response.status})`);
    error.code = "UPSTREAM_ERROR";
    throw error;
  }

  const payload = await response.json();
  if (payload?.status_code && payload.status_code !== 20000) {
    const error = new Error(payload.status_message || "DataForSEO 返回错误");
    error.code = "UPSTREAM_ERROR";
    throw error;
  }
  return mapDataForSeoResult(keyword, countryCode, payload);
}

async function getMetrics({ keyword = "", country, allowQuota = true } = {}) {
  const settings = await getSettings();
  const account = await getAccount();
  const plan = effectivePlan(account);
  const normalized = String(keyword).replace(/\s+/g, " ").trim().toLocaleLowerCase();
  const countryCode = COUNTRIES[country] ? country : settings.country;

  if (!normalized) {
    const error = new Error("Keyword is required");
    error.code = "EMPTY_KEYWORD";
    throw error;
  }
  if (!settings.enabled) {
    const error = new Error("SEOanalysis 当前已暂停");
    error.code = "DISABLED";
    throw error;
  }

  const dataSource =
    plan === "pro" && settings.dataSource === "dataforseo" && settings.dataForSeoLogin
      ? "dataforseo"
      : "local";
  const key = cacheKey(normalized, countryCode, dataSource);
  let metrics = await readCache(key);

  if (!metrics) {
    if (dataSource === "dataforseo") {
      try {
        metrics = await fetchDataForSeo(normalized, countryCode, settings);
      } catch (error) {
        metrics = estimateKeyword(normalized, { country: countryCode });
        metrics.fallbackReason = error.message;
      }
    } else {
      metrics = estimateKeyword(normalized, { country: countryCode });
    }
    await writeCache(key, metrics);
  }

  if (allowQuota) {
    await consumeQuota(account, plan, `${countryCode}:${normalized}`);
  }

  return {
    metrics,
    plan,
    quota: {
      used: plan === "pro" ? 0 : account.quota.used,
      limit: plan === "pro" ? null : FREE_DAILY_LIMIT,
      remaining: plan === "pro" ? null : Math.max(0, FREE_DAILY_LIMIT - account.quota.used)
    },
    dataSource,
    fallbackReason: metrics.fallbackReason || null
  };
}

async function analyzeKeyword({ keyword, country, addHistory = true } = {}) {
  const result = await getMetrics({ keyword, country, allowQuota: true });
  if (addHistory) {
    const account = await getAccount();
    account.history = [
      {
        keyword: result.metrics.keyword,
        country: result.metrics.country,
        volume: result.metrics.volume,
        competition: result.metrics.competition,
        source: result.metrics.source,
        analyzedAt: new Date().toISOString()
      },
      ...account.history.filter(
        (item) =>
          !(item.keyword === result.metrics.keyword && item.country === result.metrics.country)
      )
    ].slice(0, HISTORY_LIMIT);
    await saveAccount(account);
  }
  return result;
}

async function saveKeyword({ metrics }) {
  if (!metrics?.keyword) throw new Error("没有可保存的关键词");
  const account = await getAccount();
  const plan = effectivePlan(account);
  if (plan === "free" && account.saved.length >= FREE_SAVE_LIMIT) {
    const error = new Error(`免费版最多保存 ${FREE_SAVE_LIMIT} 个关键词`);
    error.code = "SAVE_LIMIT";
    throw error;
  }
  account.saved = [
    {
      ...metrics,
      savedAt: new Date().toISOString()
    },
    ...account.saved.filter(
      (item) => !(item.keyword === metrics.keyword && item.country === metrics.country)
    )
  ];
  await saveAccount(account);
  return { saved: account.saved };
}

async function removeSaved({ keyword, country }) {
  const account = await getAccount();
  account.saved = account.saved.filter(
    (item) => !(item.keyword === keyword && item.country === country)
  );
  await saveAccount(account);
  return { saved: account.saved };
}

async function startTrial() {
  const account = await getAccount();
  if (account.plan === "pro" && effectivePlan(account) === "pro") {
    return publicState(await getSettings(), account);
  }
  if (account.trialUsed) {
    const error = new Error("7 天 Pro 试用已经使用过");
    error.code = "TRIAL_USED";
    throw error;
  }
  account.plan = "pro";
  account.trialUsed = true;
  account.trialEndsAt = new Date(Date.now() + PRO_TRIAL_DAYS * 86400000).toISOString();
  await saveAccount(account);
  return publicState(await getSettings(), account);
}

async function updateSettings(patch) {
  const settings = await getSettings();
  const next = { ...settings, ...patch };
  if (patch.dataForSeoPassword === "configured") next.dataForSeoPassword = settings.dataForSeoPassword;
  if (patch.dataForSeoLogin === "configured") next.dataForSeoLogin = settings.dataForSeoLogin;
  await setLocal({ settings: next });
  return publicState(next, await getAccount());
}

async function testDataForSeo(credentials) {
  const stored = await getSettings();
  const settings = {
    ...stored,
    ...credentials,
    dataForSeoLogin:
      credentials.dataForSeoLogin === "configured"
        ? stored.dataForSeoLogin
        : credentials.dataForSeoLogin,
    dataForSeoPassword:
      credentials.dataForSeoPassword === "configured"
        ? stored.dataForSeoPassword
        : credentials.dataForSeoPassword
  };
  const result = await fetchDataForSeo("seo", "US", settings);
  return {
    ok: true,
    sample: {
      keyword: result.keyword,
      volume: result.volume,
      competition: result.competition
    }
  };
}

async function clearCache() {
  await chrome.storage.local.remove("metricCache");
  return { ok: true };
}

async function resetDemo() {
  await chrome.storage.local.remove(["account", "metricCache"]);
  return { ok: true };
}

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  const settings = await getSettings();
  const account = await getAccount();
  await setLocal({ settings, account });
  if (reason === "install") {
    await chrome.tabs.create({ url: chrome.runtime.getURL("src/welcome.html") });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const run = async () => {
    switch (message?.type) {
      case "GET_STATE":
        return publicState(await getSettings(), await getAccount());
      case "ANALYZE_KEYWORD":
        return analyzeKeyword(message.payload);
      case "GET_METRICS":
        return getMetrics(message.payload);
      case "SAVE_KEYWORD":
        return saveKeyword(message.payload);
      case "REMOVE_SAVED":
        return removeSaved(message.payload);
      case "START_TRIAL":
        return startTrial();
      case "UPDATE_SETTINGS":
        return updateSettings(message.payload);
      case "TEST_DATAFORSEO":
        return testDataForSeo(message.payload);
      case "CLEAR_CACHE":
        return clearCache();
      case "RESET_DEMO":
        return resetDemo();
      case "OPEN_POPUP":
        try {
          await chrome.action.openPopup();
        } catch {
          await chrome.windows.create({
            url: chrome.runtime.getURL("src/popup.html"),
            type: "popup",
            width: 430,
            height: 700
          });
        }
        return { ok: true };
      default:
        throw new Error("未知操作");
    }
  };

  run()
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) =>
      sendResponse({
        ok: false,
        error: {
          message: error.message,
          code: error.code || "UNKNOWN"
        }
      })
    );
  return true;
});

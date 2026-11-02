export const COUNTRIES = {
  US: {
    code: "US",
    label: "美国",
    flag: "US",
    language: "English",
    locationName: "United States",
    weight: 1
  },
  CN: {
    code: "CN",
    label: "中国",
    flag: "CN",
    language: "Chinese (Simplified)",
    locationName: "China",
    weight: 1.28
  },
  GB: {
    code: "GB",
    label: "英国",
    flag: "GB",
    language: "English",
    locationName: "United Kingdom",
    weight: 0.72
  },
  DE: {
    code: "DE",
    label: "德国",
    flag: "DE",
    language: "German",
    locationName: "Germany",
    weight: 0.68
  },
  JP: {
    code: "JP",
    label: "日本",
    flag: "JP",
    language: "Japanese",
    locationName: "Japan",
    weight: 0.77
  },
  SG: {
    code: "SG",
    label: "新加坡",
    flag: "SG",
    language: "English",
    locationName: "Singapore",
    weight: 0.54
  }
};

const INTENT_RULES = [
  {
    intent: "transactional",
    label: "交易",
    tokens: [
      "buy",
      "price",
      "pricing",
      "discount",
      "coupon",
      "deal",
      "cheap",
      "order",
      "购买",
      "价格",
      "多少钱",
      "优惠",
      "折扣",
      "团购"
    ]
  },
  {
    intent: "commercial",
    label: "商业调研",
    tokens: [
      "best",
      "top",
      "review",
      "reviews",
      "vs",
      "versus",
      "alternative",
      "comparison",
      "recommend",
      "推荐",
      "测评",
      "对比",
      "哪个好",
      "排行",
      "替代"
    ]
  },
  {
    intent: "navigational",
    label: "导航",
    tokens: [
      "login",
      "sign in",
      "download",
      "app",
      "official",
      "官网",
      "登录",
      "下载",
      "入口",
      "客服"
    ]
  },
  {
    intent: "informational",
    label: "信息",
    tokens: [
      "what",
      "how",
      "why",
      "guide",
      "tutorial",
      "meaning",
      "examples",
      "是什么",
      "怎么",
      "如何",
      "教程",
      "方法",
      "原因",
      "指南"
    ]
  }
];

const HEAD_TERMS = new Set([
  "seo",
  "ai",
  "crm",
  "vpn",
  "saas",
  "marketing",
  "fitness",
  "insurance",
  "hosting",
  "design",
  "关键词",
  "营销",
  "跨境电商",
  "独立站"
]);

const COMMERCIAL_TERMS = new Set([
  "best",
  "top",
  "price",
  "pricing",
  "buy",
  "software",
  "tool",
  "service",
  "agency",
  "推荐",
  "工具",
  "服务",
  "软件",
  "价格",
  "购买"
]);

const INFORMATIONAL_TERMS = new Set([
  "how",
  "what",
  "why",
  "guide",
  "tutorial",
  "examples",
  "怎么",
  "如何",
  "教程",
  "方法",
  "指南"
]);

const SEASONALITY = [-0.08, -0.04, 0.01, 0.04, 0.07, 0.03, -0.02, 0, 0.06, 0.12, 0.16, 0.22];

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed, offset = 0) {
  let value = (seed + Math.imul(offset + 1, 0x9e3779b1)) >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return (value >>> 0) / 4294967295;
}

function roundMetric(value, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function roundVolume(value) {
  if (value < 100) return Math.max(10, Math.round(value / 10) * 10);
  if (value < 1000) return Math.round(value / 50) * 50;
  if (value < 10000) return Math.round(value / 100) * 100;
  if (value < 100000) return Math.round(value / 500) * 500;
  return Math.round(value / 1000) * 1000;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeKeyword(keyword) {
  return String(keyword || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase();
}

function tokenize(keyword) {
  return normalizeKeyword(keyword)
    .split(/[\s,，、/|+]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function inferIntent(keyword) {
  const normalized = normalizeKeyword(keyword);
  const tokens = tokenize(keyword);

  for (const rule of INTENT_RULES) {
    if (rule.tokens.some((token) => normalized.includes(token) || tokens.includes(token))) {
      return { intent: rule.intent, label: rule.label };
    }
  }

  return { intent: "informational", label: "信息" };
}

function createTrend(keyword, volume, seed) {
  const normalized = normalizeKeyword(keyword);
  const currentMonth = new Date().getMonth();
  const commercialBias = /price|buy|deal|gift|christmas|black friday|双十一|黑五|礼物|促销/.test(normalized) ? 1 : 0;

  return Array.from({ length: 12 }, (_, index) => {
    const monthIndex = (currentMonth - 11 + index + 12) % 12;
    const seasonal = SEASONALITY[monthIndex] * (0.6 + commercialBias * 0.8);
    const drift = (index - 5.5) * (seededRandom(seed, 120) - 0.46) * 0.018;
    const noise = (seededRandom(seed, index + 40) - 0.5) * 0.14;
    const value = volume * Math.max(0.18, 1 + seasonal + drift + noise);
    return {
      month: `${monthIndex + 1}`.padStart(2, "0"),
      value: roundVolume(value)
    };
  });
}

function volumeBand(volume) {
  if (volume >= 50000) return { key: "very-high", label: "超大" };
  if (volume >= 10000) return { key: "high", label: "高" };
  if (volume >= 2000) return { key: "medium", label: "中" };
  if (volume >= 200) return { key: "low", label: "低" };
  return { key: "micro", label: "长尾" };
}

function competitionBand(competition) {
  if (competition >= 75) return { key: "hard", label: "激烈" };
  if (competition >= 55) return { key: "high", label: "偏高" };
  if (competition >= 35) return { key: "medium", label: "适中" };
  return { key: "low", label: "容易" };
}

function opportunityLabel(score) {
  if (score >= 75) return "强机会";
  if (score >= 58) return "值得测试";
  if (score >= 40) return "需要差异化";
  return "谨慎投入";
}

function opportunityBand(score) {
  if (score >= 75) return "strong";
  if (score >= 58) return "test";
  if (score >= 40) return "differentiate";
  return "cautious";
}

function buildRelatedKeywords(keyword, country, seed) {
  const normalized = normalizeKeyword(keyword);
  const isChinese = /[\u3400-\u9fff]/.test(normalized);
  const suffixes = isChinese
    ? ["教程", "价格", "推荐", "对比", "工具"]
    : ["guide", "pricing", "best tools", "vs alternatives", "for beginners"];

  return suffixes.map((suffix, index) => {
    const relatedKeyword = isChinese ? `${normalized} ${suffix}` : `${normalized} ${suffix}`;
    const relatedSeed = hashString(`${relatedKeyword}:${country}`);
    const volumeFactor = 0.2 + seededRandom(relatedSeed, index) * 0.44;
    const baseEstimate = estimateKeyword(keyword, { country, includeRelated: false });
    const competition = clamp(
      baseEstimate.competition - 16 + seededRandom(seed, index + 70) * 28,
      8,
      94
    );
    return {
      keyword: relatedKeyword,
      volume: roundVolume(baseEstimate.volume * volumeFactor),
      competition: Math.round(competition),
      intent: inferIntent(relatedKeyword).label
    };
  });
}

export function estimateKeyword(keyword, options = {}) {
  const normalized = normalizeKeyword(keyword);
  const countryCode = COUNTRIES[options.country] ? options.country : "US";
  const country = COUNTRIES[countryCode];

  if (!normalized) {
    throw new Error("请输入关键词");
  }

  const seed = hashString(normalized);
  const tokens = tokenize(normalized);
  const charLength = Math.max(3, normalized.replace(/\s/g, "").length);
  const tokenCount = Math.max(1, tokens.length);
  const intent = inferIntent(normalized);
  const headBoost = tokens.some((token) => HEAD_TERMS.has(token)) ? 7.5 : 1;
  const commercialBoost = tokens.some((token) => COMMERCIAL_TERMS.has(token)) ? 1.45 : 1;
  const informationalDamping = tokens.some((token) => INFORMATIONAL_TERMS.has(token)) ? 0.82 : 1;
  const lengthFactor = Math.pow(0.54, Math.max(0, tokenCount - 1));
  const characterFactor = clamp(1.28 - charLength / 52, 0.28, 1.18);
  const randomFactor = 0.58 + seededRandom(seed, 1) * 1.85;
  const volume = roundVolume(
    clamp(
      5600 *
        headBoost *
        commercialBoost *
        informationalDamping *
        lengthFactor *
        characterFactor *
        randomFactor *
        country.weight,
      20,
      820000
    )
  );

  const commercialIntentBoost = intent.intent === "transactional" ? 15 : intent.intent === "commercial" ? 10 : 0;
  const longTailRelief = clamp((tokenCount - 2) * 7 + Math.max(0, charLength - 16) * 0.7, 0, 28);
  const competition = Math.round(
    clamp(
      21 +
        seededRandom(seed, 5) * 45 +
        commercialIntentBoost +
        (headBoost > 1 ? 11 : 0) -
        longTailRelief,
      6,
      96
    )
  );
  const difficulty = Math.round(
    clamp(competition * 0.72 + seededRandom(seed, 8) * 17 + (volume > 10000 ? 6 : 0), 5, 97)
  );
  const cpc =
    Math.round(
      clamp(
        0.18 +
          seededRandom(seed, 12) * 3.8 +
          (intent.intent === "transactional" ? 1.2 : 0) +
          (headBoost > 1 ? 1.1 : 0),
        0.08,
        18
      ) * 100
    ) / 100;
  const opportunity = Math.round(
    clamp(
      30 +
        Math.log10(Math.max(10, volume)) * 10 -
        difficulty * 0.56 +
        (intent.intent === "commercial" || intent.intent === "transactional" ? 6 : 0),
      1,
      99
    )
  );

  return {
    keyword: normalized,
    country: countryCode,
    countryLabel: country.label,
    language: country.language,
    volume,
    volumeBand: volumeBand(volume),
    competition,
    competitionBand: competitionBand(competition),
    difficulty,
    cpc,
    opportunity,
    opportunityBand: opportunityBand(opportunity),
    opportunityLabel: opportunityLabel(opportunity),
    intent: intent.intent,
    intentLabel: intent.label,
    trend: createTrend(normalized, volume, seed),
    related:
      options.includeRelated === false
        ? []
        : buildRelatedKeywords(normalized, countryCode, seed),
    exact: false,
    source: "local",
    sourceLabel: "本地估算",
    updatedAt: new Date().toISOString()
  };
}

export function mapDataForSeoResult(keyword, countryCode, payload) {
  const result = payload?.tasks?.[0]?.result?.[0];
  if (!result || typeof result.search_volume !== "number") {
    throw new Error("数据源未返回有效关键词数据");
  }

  const country = COUNTRIES[countryCode] || COUNTRIES.US;
  const competitionIndex =
    typeof result.competition_index === "number"
      ? result.competition_index
      : result.competition === "HIGH"
        ? 78
        : result.competition === "MEDIUM"
          ? 51
          : 24;
  const cpc =
    typeof result.cpc === "number"
      ? result.cpc
      : typeof result.high_top_of_page_bid === "number"
        ? (result.low_top_of_page_bid + result.high_top_of_page_bid) / 2
        : 0;
  const volume = Math.max(0, result.search_volume);
  const difficulty = Math.round(clamp(competitionIndex * 0.74 + 10, 1, 99));
  const intent = inferIntent(keyword);
  const opportunity = Math.round(
    clamp(31 + Math.log10(Math.max(10, volume)) * 10 - difficulty * 0.56, 1, 99)
  );
  const monthlySearches = Array.isArray(result.monthly_searches)
    ? result.monthly_searches
        .slice(-12)
        .map((item) => ({ month: String(item.month).padStart(2, "0"), value: item.search_volume }))
    : createTrend(keyword, volume, hashString(`${keyword}:${countryCode}`));

  return {
    keyword: normalizeKeyword(keyword),
    country: country.code,
    countryLabel: country.label,
    language: result.language_code || country.language,
    volume,
    volumeBand: volumeBand(volume),
    competition: Math.round(competitionIndex),
    competitionBand: competitionBand(competitionIndex),
    difficulty,
    cpc: roundMetric(cpc, 2),
    opportunity,
    opportunityBand: opportunityBand(opportunity),
    opportunityLabel: opportunityLabel(opportunity),
    intent: intent.intent,
    intentLabel: intent.label,
    trend: monthlySearches,
    related: buildRelatedKeywords(keyword, country.code, hashString(`${keyword}:${country.code}`)),
    exact: true,
    source: "dataforseo",
    sourceLabel: "DataForSEO",
    updatedAt: new Date().toISOString()
  };
}

export function formatVolume(volume) {
  if (volume >= 1000000) return `${(volume / 1000000).toFixed(volume >= 10000000 ? 0 : 1)}M`;
  if (volume >= 1000) return `${(volume / 1000).toFixed(volume >= 10000 ? 0 : 1)}K`;
  return String(Math.round(volume));
}

export function formatCurrency(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

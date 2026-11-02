import test from "node:test";
import assert from "node:assert/strict";
import {
  estimateKeyword,
  formatVolume,
  mapDataForSeoResult
} from "../src/engine.js";
import {
  resolveLanguage,
  t,
  translateError
} from "../src/i18n.js";

test("local estimate is deterministic and complete", () => {
  const first = estimateKeyword("b2b seo tools", { country: "US" });
  const second = estimateKeyword("b2b seo tools", { country: "US" });

  assert.equal(first.volume, second.volume);
  assert.equal(first.competition, second.competition);
  assert.ok(first.volume > 0);
  assert.ok(first.competition >= 0 && first.competition <= 100);
  assert.equal(first.trend.length, 12);
  assert.equal(first.related.length, 5);
  assert.equal(first.exact, false);
  assert.equal(first.source, "local");
  assert.ok(["strong", "test", "differentiate", "cautious"].includes(first.opportunityBand));
});

test("long-tail keywords are generally less competitive", () => {
  const head = estimateKeyword("seo", { country: "US" });
  const tail = estimateKeyword("b2b saas seo reporting tool for agencies", { country: "US" });
  assert.ok(tail.competition < head.competition);
});

test("country selection adjusts the estimate", () => {
  const us = estimateKeyword("关键词研究", { country: "US" });
  const cn = estimateKeyword("关键词研究", { country: "CN" });
  assert.equal(cn.country, "CN");
  assert.ok(cn.volume > us.volume);
});

test("DataForSEO mapping marks values as exact", () => {
  const result = mapDataForSeoResult("keyword tool", "US", {
    tasks: [
      {
        result: [
          {
            search_volume: 12000,
            competition: "HIGH",
            competition_index: 72,
            cpc: 3.42,
            monthly_searches: Array.from({ length: 12 }, (_, index) => ({
              month: index + 1,
              search_volume: 10000 + index * 50
            }))
          }
        ]
      }
    ]
  });

  assert.equal(result.exact, true);
  assert.equal(result.source, "dataforseo");
  assert.equal(result.volume, 12000);
  assert.equal(result.competition, 72);
  assert.equal(result.cpc, 3.42);
});

test("volume formatting is compact", () => {
  assert.equal(formatVolume(950), "950");
  assert.equal(formatVolume(1200), "1.2K");
  assert.equal(formatVolume(12000), "12K");
  assert.equal(formatVolume(1500000), "1.5M");
});

test("empty keyword rejects gracefully", () => {
  assert.throws(() => estimateKeyword("   "), /请输入关键词/);
});

test("language helpers resolve, interpolate, and localize errors", () => {
  assert.equal(resolveLanguage("zh"), "zh");
  assert.equal(resolveLanguage("en"), "en");
  assert.equal(
    t("zh", "popup.quotaLine", { remaining: 28, limit: 30, used: 2 }),
    "今日额度 28/30 次 · 已用 2"
  );
  assert.equal(
    t("en", "common.remainingToday", { remaining: 3, limit: 30 }),
    "3/30 left today"
  );
  assert.equal(
    translateError({ code: "SAVE_LIMIT", limit: 20 }, "en"),
    "The free plan can save up to 20 keywords."
  );
  assert.equal(translateError({ code: "QUOTA_EXCEEDED" }, "zh"), "今日免费关键词额度已用完。");
});

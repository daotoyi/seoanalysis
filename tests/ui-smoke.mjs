import { chromium } from "playwright-core";
import { access, mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import assert from "node:assert/strict";

const root = process.cwd();
const extensionPath = root;
const screenshotDir = path.join(root, "output", "screenshots");
const profileDir = await mkdtemp(path.join(os.tmpdir(), "seoanalysis-profile-"));

async function resolveChromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const cacheRoot = path.join(os.homedir(), "Library", "Caches", "ms-playwright");
  try {
    const entries = await readdir(cacheRoot);
    const candidates = entries
      .filter((entry) => /^chromium-\d+$/.test(entry))
      .sort((left, right) => Number(right.split("-")[1]) - Number(left.split("-")[1]));
    for (const candidate of candidates) {
      const executable = path.join(
        cacheRoot,
        candidate,
        "chrome-mac-arm64",
        "Google Chrome for Testing.app",
        "Contents",
        "MacOS",
        "Google Chrome for Testing"
      );
      try {
        await access(executable);
        return executable;
      } catch {
        // Try the next cached Chromium build.
      }
    }
  } catch {
    // Playwright browser cache is optional when CHROME_PATH is provided.
  }
  throw new Error(
    "Chrome for Testing not found. Run `npx playwright install chromium` or set CHROME_PATH."
  );
}

await mkdir(screenshotDir, { recursive: true });
const chromePath = await resolveChromePath();

const context = await chromium.launchPersistentContext(profileDir, {
  executablePath: chromePath,
  headless: false,
  viewport: { width: 1180, height: 900 },
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
    "--no-first-run"
  ]
});

try {
  let [serviceWorker] = context.serviceWorkers();
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent("serviceworker", { timeout: 15000 });
  }
  const extensionId = new URL(serviceWorker.url()).host;
  assert.ok(extensionId, "extension id should be available");

  const popup = await context.newPage();
  await popup.setViewportSize({ width: 400, height: 650 });
  await popup.goto(`chrome-extension://${extensionId}/src/popup.html`);
  await popup.waitForSelector(".app-shell");
  await popup.evaluate(async () => {
    const response = await chrome.runtime.sendMessage({
      type: "UPDATE_SETTINGS",
      payload: { language: "zh" }
    });
    if (!response?.ok) throw new Error("Failed to set language");
  });
  await popup.reload();
  await popup.waitForSelector(".app-shell");
  await popup.waitForTimeout(350);
  assert.equal(await popup.locator("#planBadge").textContent(), "FREE");
  assert.equal(await popup.locator(".view-tab").count(), 3);
  assert.equal(
    (await popup.locator('.view-tab[data-view="analysis"] span').textContent()).trim(),
    "分析"
  );
  await popup.screenshot({
    path: path.join(screenshotDir, "popup-free.png"),
    fullPage: true
  });

  const options = await context.newPage();
  await options.setViewportSize({ width: 1180, height: 1040 });
  await options.goto(`chrome-extension://${extensionId}/src/options.html`);
  await options.waitForSelector(".settings-section");
  await options.waitForTimeout(350);
  assert.equal(await options.locator(".settings-section").count(), 4);
  assert.equal(await options.locator("#countrySelect option").count(), 6);
  assert.equal(await options.locator("#languageSelect").inputValue(), "zh");
  await options.screenshot({
    path: path.join(screenshotDir, "options.png"),
    fullPage: true
  });
  await options.locator("#languageSelect").selectOption("en");
  await options.waitForFunction(
    () => document.querySelector(".page-intro h1")?.textContent ===
      "Transparent data sources and page behavior"
  );
  await options.locator("#languageSelect").selectOption("zh");
  await options.waitForFunction(
    () => document.querySelector(".page-intro h1")?.textContent ===
      "让数据来源和页面体验都保持透明"
  );

  const welcome = await context.newPage();
  await welcome.setViewportSize({ width: 1180, height: 900 });
  await welcome.goto(`chrome-extension://${extensionId}/src/welcome.html`);
  await welcome.waitForSelector(".welcome-hero");
  await welcome.waitForTimeout(250);
  assert.equal(await welcome.locator(".step").count(), 3);
  assert.equal((await welcome.locator("#welcomeLanguageText").textContent()).trim(), "中");
  await welcome.screenshot({
    path: path.join(screenshotDir, "welcome.png"),
    fullPage: true
  });
  await welcome.locator("#welcomeLanguageButton").click();
  await welcome.waitForFunction(
    () => document.querySelector(".hero-copy h1")?.textContent?.includes(
      "Know whether a keyword"
    )
  );
  await welcome.locator("#welcomeLanguageButton").click();
  await welcome.waitForFunction(
    () => document.querySelector(".hero-copy h1")?.textContent?.includes(
      "搜索结果页"
    )
  );

  const serp = await context.newPage();
  await serp.setViewportSize({ width: 1280, height: 800 });
  const serpFixture = await readFile(
    path.join(root, "tests", "fixtures", "google-serp.html"),
    "utf8"
  );
  await serp.route("https://www.google.com/search**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: serpFixture
    });
  });
  await serp.goto("https://www.google.com/search?q=b2b+seo+software&hl=en", {
    waitUntil: "domcontentloaded",
    timeout: 30000
  });
  await serp.waitForTimeout(1200);
  try {
    await serp.waitForSelector("#seoanalysis-serp-root", { timeout: 12000 });
  } catch {
    await serp.screenshot({
      path: path.join(screenshotDir, "google-failure.png"),
      fullPage: false
    });
    const diagnostics = await serp.evaluate(() => ({
      title: document.title,
      url: location.href,
      searchCount: document.querySelectorAll("#search").length,
      centerCount: document.querySelectorAll("#center_col").length,
      bodyText: document.body?.innerText?.slice(0, 700)
    }));
    console.error(JSON.stringify(diagnostics, null, 2));
    throw new Error("SERP card was not injected");
  }
  await serp.waitForTimeout(500);
  const hostBox = await serp.locator("#seoanalysis-serp-root").boundingBox();
  const searchBox = await serp.locator("#search").boundingBox();
  assert.ok(hostBox, "SERP card should be visible");
  assert.ok(searchBox, "Google search container should be visible");
  assert.ok(hostBox.y + hostBox.height <= searchBox.y + 2, "SERP card should not overlap results");
  await serp.screenshot({
    path: path.join(screenshotDir, "google-serp.png"),
    fullPage: false
  });
  await serp.setViewportSize({ width: 620, height: 880 });
  await serp.waitForTimeout(250);
  const narrowOverflow = await serp.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth
  );
  assert.equal(narrowOverflow, false, "SERP card should not cause horizontal overflow");
  await serp.screenshot({
    path: path.join(screenshotDir, "google-serp-narrow.png"),
    fullPage: false
  });

  await popup.bringToFront();
  await popup.locator("#keywordInput").fill("b2b seo software");
  await popup.locator("#searchForm").press("Enter");
  await popup.waitForSelector(".result-keyword");
  await popup.waitForTimeout(250);
  assert.equal(await popup.locator(".result-keyword").textContent(), "b2b seo software");
  await popup.screenshot({
    path: path.join(screenshotDir, "popup-analysis-free.png"),
    fullPage: true
  });

  await popup.locator("#trialButton").click();
  await popup.waitForFunction(
    () => document.querySelector("#planBadge")?.textContent === "PRO",
    { timeout: 5000 }
  );
  await popup.waitForTimeout(200);
  assert.equal(await popup.locator(".trend-chart").count(), 1);
  assert.equal(await popup.locator(".related-row").count(), 5);
  assert.equal(await popup.locator("#keywordInput").inputValue(), "b2b seo software");
  await popup.screenshot({
    path: path.join(screenshotDir, "popup-analysis-pro.png"),
    fullPage: true
  });

  await popup.locator("#languageButton").click();
  await popup.waitForFunction(
    () =>
      document.querySelector('.view-tab[data-view="analysis"] span')?.textContent ===
      "Analyze"
  );
  assert.match(await popup.locator(".result-eyebrow").textContent(), /Local estimate/);
  assert.equal((await popup.locator("#languageButtonText").textContent()).trim(), "EN");
  await popup.waitForTimeout(300);
  await popup.screenshot({
    path: path.join(screenshotDir, "popup-analysis-pro-en.png"),
    fullPage: true
  });

  await options.reload();
  await options.waitForSelector(".settings-section");
  await options.waitForFunction(
    () => document.querySelector(".page-intro h1")?.textContent ===
      "Transparent data sources and page behavior"
  );
  assert.equal(await options.locator("#languageSelect").inputValue(), "en");
  await options.screenshot({
    path: path.join(screenshotDir, "options-en.png"),
    fullPage: true
  });

  await welcome.reload();
  await welcome.waitForSelector(".welcome-hero");
  await welcome.waitForFunction(
    () => document.querySelector(".hero-copy h1")?.textContent?.includes(
      "Know whether a keyword"
    )
  );
  assert.equal(
    (await welcome.locator("#welcomeLanguageText").textContent()).trim(),
    "EN"
  );
  await welcome.screenshot({
    path: path.join(screenshotDir, "welcome-en.png"),
    fullPage: true
  });

  await serp.setViewportSize({ width: 1280, height: 800 });
  await serp.reload();
  await serp.waitForSelector("#seoanalysis-serp-root");
  await serp.waitForFunction(() =>
    document.querySelector("#seoanalysis-serp-root")?.shadowRoot?.textContent?.includes(
      "Monthly volume"
    )
  );
  await serp.screenshot({
    path: path.join(screenshotDir, "google-serp-en.png"),
    fullPage: false
  });

  console.log(
    JSON.stringify(
      {
        extensionId,
        screenshots: [
          "output/screenshots/popup-free.png",
          "output/screenshots/options.png",
          "output/screenshots/welcome.png",
          "output/screenshots/google-serp.png",
          "output/screenshots/google-serp-narrow.png",
          "output/screenshots/popup-analysis-free.png",
          "output/screenshots/popup-analysis-pro.png",
          "output/screenshots/popup-analysis-pro-en.png",
          "output/screenshots/options-en.png",
          "output/screenshots/welcome-en.png",
          "output/screenshots/google-serp-en.png"
        ],
        serpCard: hostBox
      },
      null,
      2
    )
  );
} finally {
  await context.close();
  await rm(profileDir, { recursive: true, force: true });
}

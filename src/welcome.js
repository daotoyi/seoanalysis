import {
  applyTranslations,
  nextLanguagePreference,
  resolveLanguage,
  t
} from "./i18n.js";

const els = {
  startSearchButton: document.querySelector("#startSearchButton"),
  openOptionsButton: document.querySelector("#openOptionsButton"),
  privacyButton: document.querySelector("#privacyButton"),
  languageButton: document.querySelector("#welcomeLanguageButton"),
  languageText: document.querySelector("#welcomeLanguageText")
};

let state = null;

function currentLanguage() {
  return resolveLanguage(state?.settings?.language || "auto");
}

function applyLanguage() {
  applyTranslations(document, currentLanguage());
  els.languageText.textContent = currentLanguage() === "zh" ? "中" : "EN";
  els.languageButton.title = t(currentLanguage(), "welcome.languageTitle");
  els.languageButton.setAttribute("aria-label", els.languageButton.title);
  document.title = t(currentLanguage(), "welcome.title");
}

async function send(type, payload) {
  const response = await chrome.runtime.sendMessage({ type, payload });
  if (!response?.ok) throw new Error(response?.error?.message || "Operation failed");
  return response.result;
}

function openOptions() {
  chrome.runtime.openOptionsPage();
}

els.startSearchButton.addEventListener("click", () => {
  chrome.tabs.create({
    url: "https://www.google.com/search?q=b2b+seo+software"
  });
});

els.openOptionsButton.addEventListener("click", openOptions);
els.privacyButton.addEventListener("click", openOptions);

els.languageButton.addEventListener("click", async () => {
  try {
    state = await send("UPDATE_SETTINGS", {
      language: nextLanguagePreference(state?.settings?.language || "auto")
    });
    applyLanguage();
  } catch {
    // The settings page remains available if the extension worker is restarting.
  }
});

window.lucide?.createIcons({
  attrs: {
    "aria-hidden": "true",
    "stroke-width": 1.9
  }
});

send("GET_STATE")
  .then((result) => {
    state = result;
    applyLanguage();
  })
  .catch(() => applyLanguage());

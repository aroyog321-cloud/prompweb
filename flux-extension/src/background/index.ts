chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "optimize-prompt" && command !== "auto-optimize-prompt") return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  const type = command === "auto-optimize-prompt" ? "PROMPTLY_TRIGGER_AUTO_OPTIMIZE" : "PROMPTLY_TRIGGER_OPTIMIZE";
  chrome.tabs.sendMessage(tab.id, { type }).catch(() => {
    // content script not present on this page (unsupported site) - ignore
  });
});

chrome.runtime.onInstalled.addListener((details) => {
  const CORRECT_URL = "https://prompweb.vercel.app";
  const STORAGE_KEY = "promptly_settings_v1";

  if (details.reason === "install") {
    chrome.storage.local.get(STORAGE_KEY).then((res) => {
      if (!res[STORAGE_KEY]) {
        chrome.storage.local.set({
          [STORAGE_KEY]: {
            theme: "dark",
            defaultMode: "auto",
            defaultLevel: "medium",
            shortcutEnabled: true,
            apiBaseUrl: CORRECT_URL,
            apiKey: "",
            contextProfile: {},
            contextInjectionEnabled: false
          }
        });
      }
    });
  }

  // Migration: fix wrong apiBaseUrl for existing installs (update or install)
  chrome.storage.local.get(STORAGE_KEY).then((res) => {
    const current = res[STORAGE_KEY];
    if (current) {
      const wrongUrls = ["https://api.promptly-optimizer.app"];
      if (!current.apiBaseUrl || wrongUrls.includes(current.apiBaseUrl)) {
        chrome.storage.local.set({
          [STORAGE_KEY]: { ...current, apiBaseUrl: CORRECT_URL }
        });
        console.log("[Promptly] Migrated apiBaseUrl to", CORRECT_URL);
      }
    }
  });
});

// Also fix wrong URL on every browser startup (not just install/update)
function migrateApiBaseUrl() {
  const CORRECT_URL = "https://prompweb.vercel.app";
  const STORAGE_KEY = "promptly_settings_v1";
  const wrongUrls = ["https://api.promptly-optimizer.app"];

  chrome.storage.local.get(STORAGE_KEY).then((res) => {
    const current = res[STORAGE_KEY];
    if (current && (!current.apiBaseUrl || wrongUrls.includes(current.apiBaseUrl))) {
      chrome.storage.local.set({ [STORAGE_KEY]: { ...current, apiBaseUrl: CORRECT_URL } });
      console.log("[Promptly] Fixed apiBaseUrl to", CORRECT_URL);
    }
  });
}

chrome.runtime.onStartup.addListener(migrateApiBaseUrl);

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "optimize-prompt") return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  chrome.tabs.sendMessage(tab.id, { type: "FLUX_TRIGGER_OPTIMIZE" }).catch(() => {
    // content script not present on this page (unsupported site) - ignore
  });
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.storage.sync.get("flux_settings_v1").then((res) => {
      if (!res.flux_settings_v1) {
        chrome.storage.sync.set({
          flux_settings_v1: {
            theme: "dark",
            defaultMode: "general",
            defaultLevel: "medium",
            shortcutEnabled: true,
            apiBaseUrl: "https://api.flux-optimizer.app",
            apiKey: "",
            contextProfile: {},
            contextInjectionEnabled: false
          }
        });
      }
    });
  }
});

// flux-extension/src/content/authSync.ts
const STORAGE_KEY = "promptly_settings_v1";

function saveToken(token: string, apiBaseUrl: string) {
  if (!chrome.runtime?.id) return; // Context invalidated
  chrome.storage.local.get(STORAGE_KEY, (res) => {
    const current = res[STORAGE_KEY] || {};
    const next = { ...current, accessToken: token, apiBaseUrl };
    chrome.storage.local.set({ [STORAGE_KEY]: next }, () => {
      if (chrome.runtime.lastError) {
        console.error("[Promptly] storage.set failed:", chrome.runtime.lastError);
        return;
      }
      window.postMessage({ type: "PROMPTLY_AUTH_SYNCED" }, window.location.origin);
      console.log("[Promptly] Token saved. Optimizations will now sync to the server.");

      // Tell background script to trigger a drain on active extension tabs
      chrome.runtime.sendMessage({ type: "PROMPTLY_TOKEN_SAVED_DRAIN_HISTORY" }).catch(() => {});
    });
  });
}

function announce() {
  window.postMessage({ type: "PROMPTLY_EXTENSION_READY" }, window.location.origin);
}

// Announce repeatedly for the first 30s to defeat race conditions with React hydration      
announce();
let announceCount = 0;
const announceInterval = setInterval(() => {
  announceCount++;
  announce();
  if (announceCount >= 15) clearInterval(announceInterval);
}, 2000);

window.addEventListener("message", (event) => {
  // Accept same-origin and our known dev/prod origins
  const allowed = [
    "http://localhost:3000", 
    "http://127.0.0.1:3000",
    "https://proenpt.com",
    "https://app.proenpt.com",
    "https://proenpt.vercel.app"
  ];
  const ok = allowed.includes(event.origin);
  if (!ok) return;

  const data = event.data;
  if (!data) return;

  if (data.type === "PROMPTLY_AUTH_PING") {
    announce();
  } else if (data.type === "PROMPTLY_AUTH_TOKEN" && data.token) {
    // FIX 2.5: Token handoffs MUST come from the top-level window, not from any
    // iframe embedded under our origin. An attacker-controlled iframe on our domain
    // (e.g. a compromised marketing page) could otherwise inject an arbitrary token.
    if (event.source !== window) {
      console.warn("[Promptly] Ignored PROMPTLY_AUTH_TOKEN from non-window source (possible iframe injection).");
      return;
    }
    saveToken(data.token, window.location.origin);
  } else if (data.type === "PROMPTLY_LOGOUT") {
    if (!chrome.runtime?.id) return;
    chrome.storage.local.get(STORAGE_KEY, (res) => {
      const current = res[STORAGE_KEY] || {};
      chrome.storage.local.set({ [STORAGE_KEY]: { ...current, accessToken: "" } }, () => {   
        chrome.storage.local.remove("apiPlanCache");
        console.log("[Promptly Extension] Successfully cleared access token and cache due to website logout.");
      });
    });
  } else if (data.type === "PROMPTLY_PLAN_UPDATED" || data.type === "PROMPTLY_CONTEXT_UPDATED" || data.type === "PROMPTLY_HISTORY_UPDATED") {
    if (!chrome.runtime?.id) return;
    chrome.runtime.sendMessage(data).catch(() => {});
    if (data.type === "PROMPTLY_PLAN_UPDATED") {
      chrome.storage.local.remove("apiPlanCache");
    }
  }
});

// flux-extension/src/content/authSync.ts
const STORAGE_KEY = "promptly_settings_v1";

function saveToken(token: string, apiBaseUrl: string) {
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

      // Now that we have a valid token, drain any history entries that were
      // saved locally while the token was missing (e.g. the user optimized
      // prompts before ever opening the website). Import lazily to avoid
      // circular dependencies at module load time.
      import("../lib/history").then(({ useHistory }) => {
        useHistory.getState().drainPendingQueue({ accessToken: token, apiBaseUrl });
      }).catch(() => { /* non-critical */ });
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
  // This helps when Next.js wraps the dev experience in an iframe, allowing the ping to flow through
  // Removing event.source !== window restriction for robust cross-frame communication within the same origin

  const data = event.data;
  if (!data) return;

  if (data.type === "PROMPTLY_AUTH_PING") {
    announce();
  } else if (data.type === "PROMPTLY_AUTH_TOKEN" && data.token) {
    saveToken(data.token, window.location.origin);
  } else if (data.type === "PROMPTLY_LOGOUT") {
    chrome.storage.local.get(STORAGE_KEY, (res) => {
      const current = res[STORAGE_KEY] || {};
      chrome.storage.local.set({ [STORAGE_KEY]: { ...current, accessToken: "" } }, () => {   
        chrome.storage.local.remove("apiPlanCache");
        console.log("[Promptly Extension] Successfully cleared access token and cache due to website logout.");
      });
    });
  } else if (data.type === "PROMPTLY_PLAN_UPDATED" || data.type === "PROMPTLY_CONTEXT_UPDATED" || data.type === "PROMPTLY_HISTORY_UPDATED") {
    chrome.runtime.sendMessage(data).catch(() => {});
    if (data.type === "PROMPTLY_PLAN_UPDATED") {
      chrome.storage.local.remove("apiPlanCache");
    }
  }
});

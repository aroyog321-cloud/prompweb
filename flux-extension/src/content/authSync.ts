// flux-extension/src/content/authSync.ts
const STORAGE_KEY = "promptly_settings_v1";

// Nonce store: rejects replayed auth token messages within the 30s validity window.
// Using a Map to store timestamp for lazy cleanup.
const seenNonces = new Map<string, number>();

function pruneNonces() {
  const now = Date.now();
  for (const [nonce, timestamp] of seenNonces.entries()) {
    if (now - timestamp > 60000) {
      seenNonces.delete(nonce);
    }
  }
}

function parseJwt(token: string) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch(e) {
    return null;
  }
}

async function saveToken(token: string, refreshToken: string, supabaseUrl: string, supabaseAnonKey: string, apiBaseUrl: string) {
  try {
    if (!chrome.runtime?.id) return; // Context invalidated
    const res = await chrome.storage.local.get(STORAGE_KEY);
    if (!chrome.runtime?.id) return;
    const current = res[STORAGE_KEY] || {};
    
    let expiresAt = null;
    const jwt = parseJwt(token);
    if (jwt && jwt.exp) {
      expiresAt = jwt.exp * 1000; // Convert to ms
    }
    
    const next = { ...current, accessToken: token, refreshToken, supabaseUrl, supabaseAnonKey, expiresAt, apiBaseUrl };
    await chrome.storage.local.set({ [STORAGE_KEY]: next });
    if (!chrome.runtime?.id) return;
    
    window.postMessage({ type: "PROMPTLY_AUTH_SYNCED" }, window.location.origin);
    console.log("[Promptly] Token saved. Optimizations will now sync to the server.");

    // Tell background script to trigger a drain on active extension tabs
    chrome.runtime.sendMessage({ type: "PROMPTLY_TOKEN_SAVED_DRAIN_HISTORY" }).catch(() => {});
    
    // Stop announcing since we got the token
    if (announceInterval !== null) clearInterval(announceInterval);
  } catch (e) {
    console.warn("[Promptly] Extension context invalidated during auth sync", e);
  }
}

function announce() {
  window.postMessage({ type: "PROMPTLY_EXTENSION_READY" }, window.location.origin);
}

// Announce repeatedly for the first 30s to defeat race conditions with React hydration      
announce();
let announceCount = 0;
let announceInterval: ReturnType<typeof setInterval> | null = null;
announceInterval = setInterval(() => {
  announceCount++;
  announce();
  if (announceCount >= 10 && announceInterval !== null) clearInterval(announceInterval);
}, 2000);

window.addEventListener("message", async (event) => {
  pruneNonces();
  
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
    
    // Check for replay attacks:
    // 1. Timestamp must be within 30 seconds
    if (!data.timestamp || Date.now() - data.timestamp > 30000) {
      console.warn("[Promptly] Ignored PROMPTLY_AUTH_TOKEN due to missing or expired timestamp.");
      return;
    }
    // 2. Nonce must be present and must not have been seen before (replay prevention)
    if (!data.nonce || seenNonces.has(data.nonce)) {
      console.warn("[Promptly] Ignored PROMPTLY_AUTH_TOKEN: missing or replayed nonce.");
      return;
    }
    seenNonces.set(data.nonce, Date.now());
    
    try {
      const response = await fetch(`${window.location.origin}/api/me`, {
        headers: { Authorization: `Bearer ${data.token}` }
      });
      if (!response.ok) {
        console.warn("[Promptly] Token validation failed, ignoring token.");
        return;
      }
      await saveToken(data.token, data.refreshToken, data.supabaseUrl, data.supabaseAnonKey, window.location.origin);
    } catch (e) {
      console.warn("[Promptly] Token validation network error", e);
    }
  } else if (data.type === "PROMPTLY_LOGOUT") {
    try {
      if (!chrome.runtime?.id) return;
      const res = await chrome.storage.local.get(STORAGE_KEY);
      if (!chrome.runtime?.id) return;
      const current = res[STORAGE_KEY] || {};
      await chrome.storage.local.set({ [STORAGE_KEY]: { ...current, accessToken: "" } });
      if (!chrome.runtime?.id) return;
      await chrome.storage.local.remove("apiPlanCache");
      console.log("[Promptly Extension] Successfully cleared access token and cache due to website logout.");
    } catch (e) {
      console.warn("[Promptly] Extension context invalidated during logout", e);
    }
  } else if (data.type === "PROMPTLY_PLAN_UPDATED" || data.type === "PROMPTLY_CONTEXT_UPDATED" || data.type === "PROMPTLY_HISTORY_UPDATED") {
    try {
      if (!chrome.runtime?.id) return;
      chrome.runtime.sendMessage(data).catch(() => {});
      if (data.type === "PROMPTLY_PLAN_UPDATED") {
        if (!chrome.runtime?.id) return;
        await chrome.storage.local.remove("apiPlanCache");
      }
    } catch (e) {
      console.warn("[Promptly] Extension context invalidated", e);
    }
  }
});

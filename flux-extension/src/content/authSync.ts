// This script is injected into the Promptly web app (e.g. promptly.com or localhost:3000)
// It listens for authentication messages from the web app and syncs them to the extension's local storage.

window.addEventListener("message", (event) => {
  // Ensure we only listen to messages from the same window and expected origins
  if (event.source !== window) return;
  
  const allowedOrigins = ["http://localhost:3000", "http://127.0.0.1:3000"];
  // Allow any vercel preview URL dynamically
  if (!allowedOrigins.includes(event.origin) && !event.origin.endsWith(".vercel.app")) {
    return;
  }

  const data = event.data;
  
  if (data && data.type === "PROMPTLY_AUTH_TOKEN") {
    const token = data.token;
    
    if (token) {
      // Save to chrome storage
      chrome.storage.sync.get("promptly_settings_v1", (res) => {
        const current = res.promptly_settings_v1 || {};
        const updated = { ...current, accessToken: token };
        
        chrome.storage.sync.set({ promptly_settings_v1: updated }, () => {
          // Broadcast success back to the web app
          window.postMessage({ type: "PROMPTLY_AUTH_SYNCED" }, window.location.origin);
          console.log("[Promptly Extension] Successfully synced access token from website.");
        });
      });
    }
  } else if (data && data.type === "PROMPTLY_LOGOUT") {
    // User logged out from website, clear token
    chrome.storage.sync.get("promptly_settings_v1", (res) => {
      const current = res.promptly_settings_v1 || {};
      chrome.storage.sync.set({ promptly_settings_v1: { ...current, accessToken: "" } }, () => {
        console.log("[Promptly Extension] Successfully cleared access token due to website logout.");
      });
    });
  }
});

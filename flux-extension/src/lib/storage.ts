import { DEFAULT_SETTINGS, PromptlySettings } from '@promptly/types';

const STORAGE_KEY = "promptly_settings_v1";

let refreshPromise: Promise<void> | null = null;

function parseJwtExp(token: string): number | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    const jwt = JSON.parse(jsonPayload);
    return jwt.exp ? jwt.exp * 1000 : null;
  } catch (e) {
    return null;
  }
}

export async function getSettings(): Promise<PromptlySettings> {
  try {
    if (!chrome.runtime?.id) throw new Error("Extension context invalidated");
    const result = await chrome.storage.local.get(STORAGE_KEY);
    let stored = result[STORAGE_KEY] as Partial<PromptlySettings> | undefined;
    
    // Check expiration (refresh if within 1 minute of expiring, or already expired)
    const isExpiredOrClose = stored?.accessToken && stored.expiresAt && Date.now() > stored.expiresAt - 60000;

    if (isExpiredOrClose && stored?.refreshToken && stored?.supabaseUrl && stored?.supabaseAnonKey) {
      if (!refreshPromise) {
        console.log("[Promptly] Token expired or expiring soon. Attempting background refresh.");
        refreshPromise = fetch(`${stored.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": stored.supabaseAnonKey
          },
          body: JSON.stringify({ refresh_token: stored.refreshToken })
        })
        .then(res => {
          if (!res.ok) throw new Error("Refresh failed");
          return res.json();
        })
        .then(async (data) => {
          if (data.access_token && data.refresh_token) {
            console.log("[Promptly] Background token refresh successful.");
            const newExpiresAt = parseJwtExp(data.access_token) || (Date.now() + 3600 * 1000);
            
            // Re-fetch current from storage in case it changed while we were fetching
            const latestRes = await chrome.storage.local.get(STORAGE_KEY);
            const latestStored = latestRes[STORAGE_KEY] || {};
            
            const next = { 
              ...latestStored, 
              accessToken: data.access_token, 
              refreshToken: data.refresh_token, 
              expiresAt: newExpiresAt 
            };
            await chrome.storage.local.set({ [STORAGE_KEY]: next });
          } else {
            throw new Error("Invalid response");
          }
        })
        .catch(async (e) => {
          console.warn("[Promptly] Background token refresh failed. Clearing tokens.", e);
          const latestRes = await chrome.storage.local.get(STORAGE_KEY);
          const latestStored = latestRes[STORAGE_KEY] || {};
          const next = { ...latestStored, accessToken: undefined, refreshToken: undefined, expiresAt: undefined };
          await chrome.storage.local.set({ [STORAGE_KEY]: next });
        })
        .finally(() => {
          refreshPromise = null;
        });
      }
      
      // Wait for the in-progress refresh to complete
      await refreshPromise;
      
      // Re-read settings after refresh completes
      const refreshedResult = await chrome.storage.local.get(STORAGE_KEY);
      stored = refreshedResult[STORAGE_KEY] as Partial<PromptlySettings> | undefined;
    } else if (stored?.accessToken && stored.expiresAt && Date.now() > stored.expiresAt) {
      // Expired but no refresh token available
      console.log("[Promptly] Access token expired (no refresh token). Clearing.");
      stored = { ...stored, accessToken: undefined, refreshToken: undefined, expiresAt: undefined };
      chrome.storage.local.set({ [STORAGE_KEY]: stored }).catch(() => {});
    }

    // Migrate legacy levels
    if (stored?.defaultLevel) {
      const map: Record<string, any> = {
        light: "Basic",
        medium: "Professional",
        aggressive: "Staff+",
        expert: "Production Audit"
      };
      if (map[stored.defaultLevel]) {
        stored.defaultLevel = map[stored.defaultLevel];
      }
    }

    return { ...DEFAULT_SETTINGS, ...stored, contextProfile: { ...DEFAULT_SETTINGS.contextProfile, ...(stored?.contextProfile ?? {}) } };
  } catch (e) {
    console.warn("[Promptly] Failed to get settings, using defaults.", e);
    return DEFAULT_SETTINGS;
  }
}

export async function setSettings(partial: Partial<PromptlySettings>): Promise<PromptlySettings> {
  const current = await getSettings();
  const next: PromptlySettings = {
    ...current,
    ...partial,
    contextProfile: { ...current.contextProfile, ...(partial.contextProfile ?? {}) }
  };
  
  try {
    if (!chrome.runtime?.id) throw new Error("Extension context invalidated");
    await chrome.storage.local.set({ [STORAGE_KEY]: next });
  } catch (e) {
    console.warn("[Promptly] Failed to set settings.", e);
  }
  
  // Background Sync
  if (next.accessToken && next.apiBaseUrl && partial.contextProfile) {
    const endpoint = `${next.apiBaseUrl.replace(/\/$/, "")}/api/contexts`;
    fetch(endpoint, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${next.accessToken}`
      },
      body: JSON.stringify({ contextProfile: next.contextProfile })
    }).catch(err => console.error("Failed to sync context to server:", err));
  }

  return next;
}

export function onSettingsChanged(callback: (settings: PromptlySettings) => void): () => void {
  const listener = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
    if (area === "local" && changes[STORAGE_KEY]) {
      const newValue = changes[STORAGE_KEY].newValue;
      callback({
        ...DEFAULT_SETTINGS,
        ...newValue,
        contextProfile: { ...DEFAULT_SETTINGS.contextProfile, ...(newValue?.contextProfile ?? {}) }
      });
    }
  };
  try {
    if (chrome.runtime?.id) {
      chrome.storage.onChanged.addListener(listener);
    }
  } catch(e) {}
  
  // Return cleanup so callers (e.g. React useEffect) can remove the listener on unmount.
  return () => {
    try {
      if (chrome.runtime?.id) {
        chrome.storage.onChanged.removeListener(listener);
      }
    } catch(e) {}
  };
}

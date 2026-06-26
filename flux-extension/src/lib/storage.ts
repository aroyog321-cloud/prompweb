import { DEFAULT_SETTINGS, PromptlySettings } from '@promptly/types';

const STORAGE_KEY = "promptly_settings_v1";

export async function getSettings(): Promise<PromptlySettings> {
  try {
    if (!chrome.runtime?.id) throw new Error("Extension context invalidated");
    const result = await chrome.storage.local.get(STORAGE_KEY);
    let stored = result[STORAGE_KEY] as Partial<PromptlySettings> | undefined;
    
    // Check expiration
    if (stored?.accessToken && stored.expiresAt && Date.now() > stored.expiresAt) {
      console.log("[Promptly] Access token expired. Clearing.");
      stored = { ...stored, accessToken: undefined, expiresAt: undefined };
      // Fire and forget update
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

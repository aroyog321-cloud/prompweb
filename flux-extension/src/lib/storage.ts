import { DEFAULT_SETTINGS, FluxSettings } from "./types";

const STORAGE_KEY = "flux_settings_v1";

export async function getSettings(): Promise<FluxSettings> {
  const result = await chrome.storage.sync.get(STORAGE_KEY);
  const stored = result[STORAGE_KEY] as Partial<FluxSettings> | undefined;
  return { ...DEFAULT_SETTINGS, ...stored, contextProfile: { ...DEFAULT_SETTINGS.contextProfile, ...(stored?.contextProfile ?? {}) } };
}

export async function setSettings(partial: Partial<FluxSettings>): Promise<FluxSettings> {
  const current = await getSettings();
  const next: FluxSettings = {
    ...current,
    ...partial,
    contextProfile: { ...current.contextProfile, ...(partial.contextProfile ?? {}) }
  };
  await chrome.storage.sync.set({ [STORAGE_KEY]: next });
  return next;
}

export function onSettingsChanged(callback: (settings: FluxSettings) => void) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes[STORAGE_KEY]) {
      const newValue = changes[STORAGE_KEY].newValue;
      callback({
        ...DEFAULT_SETTINGS,
        ...newValue,
        contextProfile: { ...DEFAULT_SETTINGS.contextProfile, ...(newValue?.contextProfile ?? {}) }
      });
    }
  });
}

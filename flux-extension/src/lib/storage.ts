import { DEFAULT_SETTINGS, PromptlySettings } from '@promptly/types';

const STORAGE_KEY = "promptly_settings_v1";

export async function getSettings(): Promise<PromptlySettings> {
  const result = await chrome.storage.sync.get(STORAGE_KEY);
  const stored = result[STORAGE_KEY] as Partial<PromptlySettings> | undefined;
  return { ...DEFAULT_SETTINGS, ...stored, contextProfile: { ...DEFAULT_SETTINGS.contextProfile, ...(stored?.contextProfile ?? {}) } };
}

export async function setSettings(partial: Partial<PromptlySettings>): Promise<PromptlySettings> {
  const current = await getSettings();
  const next: PromptlySettings = {
    ...current,
    ...partial,
    contextProfile: { ...current.contextProfile, ...(partial.contextProfile ?? {}) }
  };
  await chrome.storage.sync.set({ [STORAGE_KEY]: next });
  return next;
}

export function onSettingsChanged(callback: (settings: PromptlySettings) => void) {
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

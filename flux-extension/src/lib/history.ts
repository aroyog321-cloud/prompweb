import { create } from "zustand";
import { PromptMode, RewriteLevel } from '@promptly/types';

export interface HistoryEntry {
  id: string;
  text: string;
  optimized: string;
  mode: PromptMode;
  level: RewriteLevel;
  platform: string;
  ts: number;
  source: "api" | "local-fallback";
  isStarred?: boolean;
}

interface HistoryState {
  entries: HistoryEntry[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  add: (entry: Omit<HistoryEntry, "id" | "ts">) => Promise<HistoryEntry>;
  remove: (id: string) => Promise<void>;
  clear: () => Promise<void>;
  toggleStar: (id: string) => Promise<void>;
}

const STORAGE_KEY = "promptly_history_v1";
const MAX_ENTRIES = 50;

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function isChromeStorageAvailable(): boolean {
  try {
    return typeof chrome !== "undefined" && !!chrome.storage?.local;
  } catch {
    return false;
  }
}

async function readStorage(): Promise<HistoryEntry[]> {
  if (!isChromeStorageAvailable()) return [];
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const raw = result?.[STORAGE_KEY];
  if (!Array.isArray(raw)) return [];
  return raw as HistoryEntry[];
}

async function writeStorage(entries: HistoryEntry[]): Promise<void> {
  if (!isChromeStorageAvailable()) return;
  await chrome.storage.local.set({ [STORAGE_KEY]: entries });
}

import { getSettings } from "./storage";

export const useHistory = create<HistoryState>((set, get) => ({
  entries: [],
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    const localEntries = await readStorage();
    let finalEntries = [...localEntries];
    
    try {
      const settings = await getSettings();
      if (settings.apiBaseUrl && settings.accessToken) {
        const endpoint = `${settings.apiBaseUrl.replace(/\/$/, "")}/api/history?limit=${MAX_ENTRIES}`;
        const res = await fetch(endpoint, {
          headers: { Authorization: `Bearer ${settings.accessToken}` }
        });
        if (res.ok) {
          const serverEntries = await res.json();
          // Merge server and local, deduping by ID or text
          const merged = new Map<string, HistoryEntry>();
          serverEntries.forEach((se: any) => {
             merged.set(se.id, {
               id: se.id,
               text: se.originalPrompt,
               optimized: se.optimizedPrompt,
               platform: se.platformUsed,
               mode: (se.promptMode || "auto").toLowerCase(),
               level: (se.rewriteLevel || "medium").toLowerCase(),
               ts: new Date(se.createdAt).getTime(),
               source: "api"
             });
          });
          localEntries.forEach(le => {
             if (!merged.has(le.id)) merged.set(le.id, le);
          });
          finalEntries = Array.from(merged.values()).sort((a, b) => b.ts - a.ts).slice(0, MAX_ENTRIES);
          await writeStorage(finalEntries);
        }
      }
    } catch (e) {
      console.warn("Failed to hydrate history from server", e);
    }
    
    set({ entries: finalEntries, hydrated: true });
  },

  add: async (partial) => {
    const entry: HistoryEntry = {
      id: newId(),
      ts: Date.now(),
      ...partial
    };
    const next = [entry, ...get().entries].slice(0, MAX_ENTRIES);
    set({ entries: next });
    await writeStorage(next);

    // Sync to backend if it's a local fallback or we just want to ensure it's logged
    if (partial.source === "local-fallback") {
      try {
        const settings = await getSettings();
        if (settings.apiBaseUrl && settings.accessToken) {
          const endpoint = `${settings.apiBaseUrl.replace(/\/$/, "")}/api/history`;
          await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${settings.accessToken}`
            },
            body: JSON.stringify({
              originalPrompt: entry.text,
              optimizedPrompt: entry.optimized,
              platformUsed: entry.platform,
              promptMode: entry.mode,
              rewriteLevel: entry.level
            })
          });
        }
      } catch (e) {
        console.warn("Failed to sync history to server", e);
      }
    }

    return entry;
  },

  remove: async (id) => {
    const next = get().entries.filter((e) => e.id !== id);
    set({ entries: next });
    await writeStorage(next);
  },

  clear: async () => {
    set({ entries: [] });
    await writeStorage([]);
  },

  toggleStar: async (id) => {
    const next = get().entries.map((e) => e.id === id ? { ...e, isStarred: !e.isStarred } : e);
    set({ entries: next });
    await writeStorage(next);
  }
}));

/** Format a timestamp as a compact relative time: "now", "12s", "5m", "3h", "yesterday", "Mar 4". */
export function formatRelative(ts: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - ts);
  const sec = Math.floor(diff / 1000);
  if (sec < 5) return "now";
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "yesterday";
  if (day < 7) return `${day}d`;
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

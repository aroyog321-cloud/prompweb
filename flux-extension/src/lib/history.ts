import { create } from "zustand";
import { PromptMode, RewriteLevel } from '@promptly/types';
import { getSettings } from "./storage";

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
  add: (entry: Omit<HistoryEntry, "id" | "ts">, auth?: { accessToken?: string; apiBaseUrl?: string }) => Promise<HistoryEntry>;
  remove: (id: string) => Promise<void>;
  clear: () => Promise<void>;
  toggleStar: (id: string) => Promise<void>;
  drainPendingQueue: (auth: { accessToken: string; apiBaseUrl: string }) => Promise<void>;
}

const STORAGE_KEY = "promptly_history_v1";
// Entries that failed to POST (no token at the time) — retried when token arrives
const PENDING_KEY = "promptly_pending_sync_v1";
const MAX_ENTRIES = 50;

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function isChromeStorageAvailable(): boolean {
  try {
    return (
      typeof chrome !== "undefined" &&
      !!chrome.runtime?.id &&
      !!chrome.storage?.local
    );
  } catch {
    return false;
  }
}

function safeGetStorage(key: string): Promise<any> {
  return new Promise((resolve) => {
    if (!isChromeStorageAvailable()) return resolve(undefined);
    try {
      chrome.storage.local.get(key, (res) => {
        if (chrome.runtime.lastError) {
          console.warn("[Promptly] Storage get error:", chrome.runtime.lastError.message);
          return resolve(undefined);
        }
        resolve(res);
      });
    } catch (e) {
      resolve(undefined);
    }
  });
}

function safeSetStorage(data: any): Promise<void> {
  return new Promise((resolve) => {
    if (!isChromeStorageAvailable()) return resolve();
    try {
      chrome.storage.local.set(data, () => {
        if (chrome.runtime.lastError) {
          console.warn("[Promptly] Storage set error:", chrome.runtime.lastError.message);
        }
        resolve();
      });
    } catch (e) {
      resolve();
    }
  });
}

async function readStorage(): Promise<HistoryEntry[]> {
  const result = await safeGetStorage(STORAGE_KEY);
  const raw = result?.[STORAGE_KEY];
  if (!Array.isArray(raw)) return [];
  return raw as HistoryEntry[];
}

async function writeStorage(entries: HistoryEntry[]): Promise<void> {
  await safeSetStorage({ [STORAGE_KEY]: entries });
}

async function readPendingQueue(): Promise<Array<Omit<HistoryEntry, "id" | "ts"> & { id: string; ts: number }>> {
  const result = await safeGetStorage(PENDING_KEY);
  const raw = result?.[PENDING_KEY];
  return Array.isArray(raw) ? raw : [];
}

async function writePendingQueue(queue: any[]): Promise<void> {
  await safeSetStorage({ [PENDING_KEY]: queue });
}

async function addToPendingQueue(entry: HistoryEntry): Promise<void> {
  const queue = await readPendingQueue();
  // Avoid duplicates by id
  if (queue.some((e) => e.id === entry.id)) return;
  queue.push(entry);
  // Keep queue bounded at 50 so it doesn't grow unbounded on long offline stretches
  await writePendingQueue(queue.slice(-50));
}

async function postEntryToServer(
  entry: HistoryEntry,
  auth: { accessToken: string; apiBaseUrl: string }
): Promise<{ serverId?: string; ok: boolean }> {
  try {
    const API_BASE = auth.apiBaseUrl.replace(/\/$/, "");
    const res = await fetch(`${API_BASE}/api/history`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.accessToken}`,
      },
      body: JSON.stringify({
        originalPrompt: entry.text,
        optimizedPrompt: entry.optimized,
        platformUsed: entry.platform,
        promptMode: entry.mode,
        rewriteLevel: entry.level,
      }),
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: true, serverId: data?.id };
    }
    console.warn("[Promptly] Server POST returned", res.status);
    return { ok: false };
  } catch (e) {
    console.warn("[Promptly] Server POST failed:", e);
    return { ok: false };
  }
}

export const useHistory = create<HistoryState>((set, get) => ({
  entries: [],
  hydrated: false,

  hydrate: async () => {
    const localEntries = await readStorage();
    let finalEntries = [...localEntries];

    try {
      const settings = await getSettings();
      if (settings.apiBaseUrl && settings.accessToken) {
        const API_BASE = settings.apiBaseUrl.replace(/\/$/, "");
        const res = await fetch(`${API_BASE}/api/history?limit=${MAX_ENTRIES}`, {
          headers: { Authorization: `Bearer ${settings.accessToken}` },
        });
        if (res.ok) {
          const serverEntries = await res.json();
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
              source: "api",
              isStarred: se.isStarred ?? false,
            });
          });
          localEntries.forEach((le) => {
            if (!merged.has(le.id)) merged.set(le.id, le);
          });
          finalEntries = Array.from(merged.values())
            .sort((a, b) => b.ts - a.ts)
            .slice(0, MAX_ENTRIES);
          await writeStorage(finalEntries);

          // Now that we have a valid token, drain any queued entries that
          // failed to POST when the token was not yet available.
          await get().drainPendingQueue({
            accessToken: settings.accessToken,
            apiBaseUrl: settings.apiBaseUrl,
          });
        }
      }
    } catch (e) {
      console.warn("[Promptly] Failed to hydrate history from server", e);
    }

    set({ entries: finalEntries, hydrated: true });
  },

  /**
   * drainPendingQueue — call this whenever a fresh access token becomes
   * available. It reads the local pending queue (entries that were saved
   * locally but couldn't be POSTed because no token existed at the time)
   * and sends each one to the server, clearing the queue on success.
   */
  drainPendingQueue: async (auth) => {
    if (!auth.accessToken || !auth.apiBaseUrl) return;
    const queue = await readPendingQueue();
    if (queue.length === 0) return;

    console.log(`[Promptly] Draining ${queue.length} pending history entries to server…`);
    const remaining: any[] = [];

    for (const entry of queue) {
      const { ok } = await postEntryToServer(entry as HistoryEntry, auth);
      if (!ok) remaining.push(entry);
    }

    await writePendingQueue(remaining);
    if (remaining.length < queue.length) {
      console.log(
        `[Promptly] Synced ${queue.length - remaining.length} pending entries. ${remaining.length} still queued.`
      );
    }
  },

  add: async (partial, auth) => {
    const entry: HistoryEntry = {
      id: newId(),
      ts: Date.now(),
      ...partial,
    };
    const next = [entry, ...get().entries].slice(0, MAX_ENTRIES);
    set({ entries: next });
    await writeStorage(next);

    // Attempt to POST to the server
    try {
      const settings = await getSettings();
      const apiBaseUrl = auth?.apiBaseUrl || settings.apiBaseUrl;
      const accessToken = auth?.accessToken || settings.accessToken;

      if (apiBaseUrl && accessToken) {
        // Token available — POST immediately
        const { ok, serverId } = await postEntryToServer(entry, {
          accessToken,
          apiBaseUrl,
        });
        if (ok && serverId) {
          const updated = get().entries.map((e) =>
            e.id === entry.id ? { ...e, id: serverId } : e
          );
          set({ entries: updated });
          await writeStorage(updated);
        } else if (!ok) {
          // POST failed despite having a token (network hiccup, server error).
          // Queue it for retry on next hydration/token refresh.
          await addToPendingQueue(entry);
        }
      } else {
        // No token yet — queue so we can retry once the user visits the website
        // and AuthSyncComponent delivers the token to the extension.
        console.log(
          "[Promptly] No access token — queuing entry for later server sync."
        );
        await addToPendingQueue(entry);
      }
    } catch (e) {
      console.warn("[Promptly] history.add server sync error:", e);
      // Queue as a fallback so data is not permanently lost
      await addToPendingQueue(entry);
    }

    return entry;
  },

  remove: async (id) => {
    const next = get().entries.filter((e) => e.id !== id);
    set({ entries: next });
    await writeStorage(next);

    // Sync deletion to server
    try {
      const settings = await getSettings();
      if (settings.apiBaseUrl && settings.accessToken) {
        fetch(`${settings.apiBaseUrl.replace(/\/$/, "")}/api/history?id=${encodeURIComponent(id)}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${settings.accessToken}` },
        }).catch(e => console.warn("[Promptly] Server delete failed:", e));
      }
    } catch(e) {}
  },

  clear: async () => {
    set({ entries: [] });
    await writeStorage([]);
  },

  toggleStar: async (id) => {
    const entry = get().entries.find((e) => e.id === id);
    if (!entry) return;
    const newStarred = !entry.isStarred;
    const next = get().entries.map((e) =>
      e.id === id ? { ...e, isStarred: newStarred } : e
    );
    set({ entries: next });
    await writeStorage(next);

    try {
      const settings = await getSettings();
      const CORRECT_URL = "https://proenpt.vercel.app";
      const wrongUrls = ["https://api.promptly-optimizer.app"];
      const rawUrl = settings.apiBaseUrl;
      const apiBaseUrl =
        !rawUrl || wrongUrls.includes(rawUrl) ? CORRECT_URL : rawUrl;
      const accessToken = settings.accessToken;

      if (apiBaseUrl && accessToken) {
        fetch(`${apiBaseUrl}/api/history`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ id, isStarred: newStarred }),
        }).catch((e) => console.warn("[Promptly] Star sync failed:", e));
      }
    } catch (e) {
      console.warn("[Promptly] toggleStar server sync error:", e);
    }
  },
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

import React, { useEffect, useState } from "react";
import { useHistory, HistoryEntry, formatRelative } from "../lib/history";

interface HistoryPanelProps {
  open: boolean;
  onClose: () => void;
  onSelect: (entry: HistoryEntry) => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({ open, onClose, onSelect }) => {
  const { entries, hydrated, hydrate, clear, toggleStar } = useHistory();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"history" | "library">("history");

  useEffect(() => {
    if (open) hydrate();
  }, [open, hydrate]);

  if (!open) return null;

  const displayedEntries = entries.filter(e => {
    if (tab === "library" && !e.isStarred) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return e.text.toLowerCase().includes(q) || e.optimized.toLowerCase().includes(q);
  });

  return (
    <div className="promptly-history">
      <div className="promptly-history-header" style={{ paddingBottom: 0 }}>
        <div style={{ display: "flex", gap: 16 }}>
          <button 
            className={`promptly-tab ${tab === "history" ? "active" : ""}`} 
            onClick={() => setTab("history")}
            style={{ background: "none", border: "none", color: tab === "history" ? "var(--fg)" : "var(--fg-muted)", fontSize: 13, fontWeight: 600, paddingBottom: 8, borderBottom: tab === "history" ? "2px solid var(--primary)" : "2px solid transparent", cursor: "pointer" }}
          >
            History
          </button>
          <button 
            className={`promptly-tab ${tab === "library" ? "active" : ""}`} 
            onClick={() => setTab("library")}
            style={{ background: "none", border: "none", color: tab === "library" ? "var(--fg)" : "var(--fg-muted)", fontSize: 13, fontWeight: 600, paddingBottom: 8, borderBottom: tab === "library" ? "2px solid var(--primary)" : "2px solid transparent", cursor: "pointer" }}
          >
            Library
          </button>
        </div>
        <div className="actions" style={{ marginBottom: 8 }}>
          {entries.length > 0 && tab === "history" && (
            <button className="promptly-btn-icon" onClick={clear} title="Clear all" style={{ color: "var(--accent-error)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path>
              </svg>
            </button>
          )}
          <button className="promptly-btn-icon close" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {(entries.length > 0 || tab === "library") ? (
        <>
          <div className="promptly-search" style={{ marginTop: 12 }}>
            <div className="icon">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </div>
            <input 
              type="text" 
              placeholder={`Search ${tab}...`}
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              autoFocus 
            />
          </div>
          
          <div className="promptly-history-list">
            {displayedEntries.map((entry, i) => (
              <div 
                key={entry.id} 
                className="promptly-history-item" 
                style={{ "--i": i, cursor: "pointer" } as any}
              >
                <div className="row" onClick={() => { onSelect(entry); onClose(); }}>
                  <span className="mode-badge">{entry.mode}</span>
                  <div className="promptly-mini-bars">
                    {[1,2,3,4].map(b => (
                      <span key={b} className={`bar ${b <= (['light','medium','aggressive','expert'].indexOf(entry.level) + 1 || 2) ? 'on' : ''}`} />
                    ))}
                  </div>
                  <span className="time">{formatRelative(entry.ts)}</span>
                </div>
                <div className="preview" onClick={() => { onSelect(entry); onClose(); }}>
                  {entry.optimized || entry.text}
                </div>
                <div className="row" style={{ marginTop: 8, justifyContent: "space-between" }}>
                  <div className="src">Via {entry.source === 'api' ? 'Promptly API' : 'Local Fallback'}</div>
                  <button 
                    className="promptly-btn-icon" 
                    onClick={(e) => { e.stopPropagation(); toggleStar(entry.id); }}
                    title={entry.isStarred ? "Remove from Library" : "Add to Library"}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill={entry.isStarred ? "var(--primary)" : "none"} stroke={entry.isStarred ? "var(--primary)" : "currentColor"} strokeWidth="2">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                    </svg>
                  </button>
                </div>
              </div>
            ))}
            {displayedEntries.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-quaternary)', fontSize: '11px' }}>
                {tab === "library" && !search ? "No starred prompts yet. Star a prompt in History to add it here." : `No results found for "${search}"`}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="promptly-history-empty">
          <div className="icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <div className="title">No History Yet</div>
          <div className="desc">Your optimized prompts will appear here automatically.</div>
        </div>
      )}
    </div>
  );
};

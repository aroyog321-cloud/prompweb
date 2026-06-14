import React, { useState, useEffect, useRef } from "react";
import { getSettings } from "../lib/storage";
import { optimizePrompt } from "../lib/promptEngine";
import { FluxSettings } from "../lib/types";

interface Props {
  initialText: string;
  onReplace: (text: string) => void;
  onClose: () => void;
}

export const OptimizerPanel: React.FC<Props> = ({ initialText, onReplace, onClose }) => {
  const [settings, setSettings] = useState<FluxSettings | null>(null);
  const [text, setText] = useState(initialText);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizedText, setOptimizedText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !e.composedPath().includes(panelRef.current)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const hasAutoOptimized = useRef(false);

  useEffect(() => {
    if (settings && text.trim() && !hasAutoOptimized.current) {
      hasAutoOptimized.current = true;
      handleOptimize();
    }
  }, [settings]);

  const handleOptimize = async (overrideMode?: any) => {
    if (!text.trim() || !settings) return;

    setIsOptimizing(true);
    setError(null);
    
    const modeToUse = overrideMode || settings.defaultMode;

    try {
      const result = await optimizePrompt({
        text,
        mode: modeToUse,
        level: settings.defaultLevel,
        context: settings.contextInjectionEnabled ? settings.contextProfile : undefined,
      }, {
        apiBaseUrl: settings.apiBaseUrl,
        apiKey: settings.apiKey
      });
      setOptimizedText(result.optimized);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Optimization failed");
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleAccept = () => {
    if (optimizedText) {
      onReplace(optimizedText);
      onClose();
    }
  };

  if (!settings) return null;

  return (
    <div
      ref={panelRef}
      className="flux-panel flux-panel-wrapper flux-panel-animate-in"
      style={{ width: 400, maxWidth: "90vw", maxHeight: "85vh", display: "flex", flexDirection: "column" }}
    >
      <div className="flux-header" style={{ flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ 
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 20, height: 20, borderRadius: 4, background: "var(--text-primary)", color: "var(--surface-base)"
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "-0.02em" }}>Flux</span>
        </div>
        
        <div style={{ display: "flex", gap: 6 }}>
          <select 
            className="flux-select"
            value={settings.defaultMode}
            onChange={(e) => {
              const newMode = e.target.value as any;
              setSettings({ ...settings, defaultMode: newMode });
              handleOptimize(newMode);
            }}
          >
            <option value="GENERAL">General</option>
            <option value="DEVELOPER">Developer</option>
            <option value="DESIGNER">Designer</option>
            <option value="MARKETING">Marketing</option>
          </select>
          <button className="flux-btn-icon" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div style={{ flex: 1, padding: 16, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
        {error && (
          <div style={{ padding: "8px 12px", background: "rgba(255, 50, 50, 0.1)", border: "1px solid rgba(255, 50, 50, 0.2)", borderRadius: 6, color: "#ff8888", fontSize: 12 }}>
            {error}
          </div>
        )}

        {isOptimizing ? (
          <div style={{ flex: 1, minHeight: 180, display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="flux-skeleton" style={{ width: "95%", height: 14, borderRadius: 4 }} />
            <div className="flux-skeleton" style={{ width: "100%", height: 14, borderRadius: 4 }} />
            <div className="flux-skeleton" style={{ width: "85%", height: 14, borderRadius: 4 }} />
            <div className="flux-skeleton" style={{ width: "90%", height: 14, borderRadius: 4, marginTop: 12 }} />
            <div className="flux-skeleton" style={{ width: "60%", height: 14, borderRadius: 4 }} />
            <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 8, opacity: 0.7 }}>
              <div className="flux-orb compact flux-loading" style={{ width: 20, height: 20, cursor: "default" }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2"/>
                  <path d="M12 6v5l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <span className="flux-shimmer-text" style={{ fontSize: 11, fontWeight: 500 }}>Analyzing and rewriting...</span>
            </div>
          </div>
        ) : (
          <textarea
            className="flux-textarea"
            value={optimizedText || text}
            onChange={(e) => {
              if (optimizedText) setOptimizedText(e.target.value);
              else setText(e.target.value);
            }}
            placeholder="Type your rough idea here..."
            autoFocus
          />
        )}
      </div>

      {!isOptimizing && (
        <div style={{ padding: 16, borderTop: "1px solid var(--border-subtle)", display: "flex", gap: 8, background: "rgba(0,0,0,0.2)" }}>
          {optimizedText ? (
            <>
              <button className="flux-btn-secondary" onClick={() => setOptimizedText(null)}>
                Discard
              </button>
              <button className="flux-btn-secondary" onClick={() => handleOptimize()} title="Generate another variation">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', marginRight: 4, verticalAlign: 'text-bottom' }}>
                  <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                  <path d="M21 3v5h-5" />
                </svg>
                Regenerate
              </button>
              <button className="flux-btn-primary" onClick={handleAccept}>
                Insert Optimized
              </button>
            </>
          ) : (
            <button 
              className="flux-btn-primary" 
              onClick={handleOptimize}
              disabled={!text.trim()}
              style={{ width: "100%" }}
            >
              Optimize Prompt
            </button>
          )}
        </div>
      )}
    </div>
  );
};

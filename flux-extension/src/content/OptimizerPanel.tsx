import React, { useState, useEffect, useRef } from "react";
import { getSettings, setSettings as saveSettings, onSettingsChanged } from "../lib/storage";
import { optimizePrompt } from "../lib/promptEngine";
import { PromptlySettings, PromptMode, RewriteLevel, PromptStyle, PROMPT_STYLES, PROMPT_MODES } from '@promptly/types';
import { Segmented } from "./Segmented";
import { IntensityBars } from "./IntensityBars";
import { StreamingText } from "./StreamingText";
import { DiffView } from "./DiffView";
import { useHistory } from "../lib/history";

interface Props {
  initialText: string;
  onReplace: (text: string) => void;
  onClose: () => void;
  onOpenHistory: () => void;
}

const PLACEHOLDERS = [
  "make me a logo for a coffee shop",
  "write a sales email to a VP of marketing",
  "explain quantum computing to a 10 year old",
  "create a react component for a date picker",
  "summarize this article in 3 bullets"
];

export const OptimizerPanel: React.FC<Props> = ({ initialText, onReplace, onClose, onOpenHistory }) => {
  const [placeholderIdx, setPlaceholderIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setPlaceholderIdx(prev => (prev + 1) % PLACEHOLDERS.length), 4000);
    return () => clearInterval(interval);
  }, []);

  const [settings, setSettings] = useState<PromptlySettings | null>(null);
  const [text, setText] = useState(initialText);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [optimizedText, setOptimizedText] = useState<string | null>(null);
  const [originalTextUsed, setOriginalTextUsed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [refinementInput, setRefinementInput] = useState("");
  
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const history = useHistory();

  useEffect(() => {
    getSettings().then(setSettings);
    const cleanup = onSettingsChanged(setSettings);
    return cleanup;
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !e.composedPath().includes(panelRef.current)) onClose();
    };
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        if (e.shiftKey) {
          if (optimizedText && !isOptimizing && !isStreaming) handleAccept();
        } else {
          if (!isOptimizing && !isStreaming) handleOptimize();
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "h") {
        e.preventDefault();
        onOpenHistory?.();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "c" && optimizedText && !isStreaming) {
        if (window.getSelection()?.toString()) return;
        e.preventDefault();
        navigator.clipboard.writeText(optimizedText);
        setToast("Copied ✓");
        setTimeout(() => setToast(null), 2000);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d" && optimizedText && !isStreaming) {
        e.preventDefault();
        setOptimizedText(null);
        setShowDiff(false);
      }
    };
    
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, optimizedText, isOptimizing, isStreaming]);

  const handleScroll = () => {
    if (bodyRef.current) setScrolled(bodyRef.current.scrollTop > 5);
  };

  const hasAutoOptimized = useRef(false);
  useEffect(() => {
    if (settings && text.trim() && !hasAutoOptimized.current) {
      hasAutoOptimized.current = true;
      handleOptimize();
    }
  }, [settings]);

  const handleOptimize = async (overrideMode?: PromptMode, overrideLevel?: RewriteLevel, overrideStyle?: PromptStyle, refinement?: string) => {
    if (!text.trim() || !settings) return;

    if (refinement) {
      setRefinementInput("");
    }

    const currentGeneratedText = optimizedText;
    
    setIsStreaming(false);
    setOptimizedText(null);
    setShowDiff(false);
    setError(null);
    setOriginalTextUsed(text);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const modeToUse = overrideMode || settings.defaultMode;
    const levelToUse = overrideLevel || settings.defaultLevel;
    const styleToUse = overrideStyle || settings.defaultStyle;

    try {
      setIsOptimizing(true);
      setIsStreaming(false);
      setOptimizedText("");
      let streamedText = "";

      const result = await optimizePrompt({
        text,
        mode: modeToUse,
        level: levelToUse,
        style: styleToUse,
        context: settings.contextInjectionEnabled ? settings.contextProfile : undefined,
        stream: true,
        refinement,
        previousPrompt: refinement && currentGeneratedText ? currentGeneratedText : undefined,
        platform: window.location.hostname
      }, {
        apiBaseUrl: settings.apiBaseUrl,
        apiKey: settings.apiKey,
        categorizerApiUrl: settings.categorizerApiUrl,
        categorizerApiKey: settings.categorizerApiKey,
        accessToken: settings.accessToken
      }, {
        onChunk: (chunk) => {
          setIsOptimizing(false);
          setIsStreaming(true);
          streamedText += chunk;
          setOptimizedText(streamedText);
        },
        abortSignal: abortControllerRef.current.signal
      });

      setIsOptimizing(false);
      setIsStreaming(false);
      history.add({
        text,
        optimized: result.optimized || streamedText,
        mode: modeToUse,
        level: levelToUse,
        platform: window.location.hostname,
        source: result.source as any
      }, { accessToken: settings.accessToken, apiBaseUrl: settings.apiBaseUrl });

      // Broadcast so HistoryPanel refreshes live without needing to re-open
      window.postMessage({ type: "PROMPTLY_HISTORY_UPDATED" }, window.location.origin);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Optimization failed");
      setIsOptimizing(false);
      setIsStreaming(false);
    }
  };

  const variables = React.useMemo(() => {
    if (!optimizedText) return [];
    const matches = optimizedText.match(/{{([^}]+)}}/g);
    if (!matches) return [];
    return [...new Set(matches.map(m => m.slice(2, -2).trim()))];
  }, [optimizedText]);

  const [fillingVariables, setFillingVariables] = useState(false);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});

  const handleAccept = () => {
    if (optimizedText) {
      if (variables.length > 0 && !fillingVariables) {
        setFillingVariables(true);
        return;
      }
      
      let finalOutput = optimizedText;
      if (fillingVariables) {
        Object.entries(variableValues).forEach(([key, value]) => {
          if (value.trim()) {
            finalOutput = finalOutput.replace(new RegExp(`{{${key}}}`, 'g'), value);
          }
        });
      }

      setToast("Inserted ✓");
      setTimeout(() => {
        onReplace(finalOutput);
        onClose();
      }, 1000);
      onReplace(finalOutput);
    }
  };

  if (!settings) return null;

  // Removed hardcoded MODES array

  let meta = null;
  if (optimizedText && !isStreaming) {
    const words = optimizedText.split(/\s+/).filter(Boolean);
    const uniqueWords = new Set(words.map(w => w.toLowerCase())).size;
    const sentences = optimizedText.split(/[.!?]+/).filter(Boolean);
    const avgSentenceLen = sentences.length ? words.length / sentences.length : 0;
    const score = Math.min(100, Math.round((uniqueWords / (words.length || 1)) * 100 + avgSentenceLen * 5));
    let complexity = "Low";
    let complexityClass = "complexity-low";
    if (score > 80) { complexity = "High"; complexityClass = "complexity-high"; }
    else if (score > 60) { complexity = "Medium"; complexityClass = "complexity-medium"; }
    
    const tokenEstimate = Math.round(words.length * 1.3);

    meta = (
      <div className="promptly-meta">
        <span title={`~${tokenEstimate} tokens`}>{words.length} words</span>
        <span>•</span>
        <div className={`pill ${complexityClass}`}><span className="dot" /> {complexity}</div>
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      className="promptly-panel promptly-panel-wrapper promptly-panel-animate-in"
      style={{ width: 480, maxWidth: "90vw", maxHeight: "85vh", display: "flex", flexDirection: "column" }}
    >
      {toast && <div className="promptly-toast"><span className="check">✓</span> {toast.replace(' ✓', '')}</div>}

      <div className="promptly-header" data-scrolled={scrolled} style={{ flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="promptly-status">
            <span className="dot on" />
            <span>Online</span>
          </div>
          <span className="promptly-wordmark">Promptly</span>
        </div>
        
        <div style={{ display: "flex", gap: 4 }}>
          <button className="promptly-btn-icon" onClick={onOpenHistory} title="History (Cmd+H)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
          </button>
          <button className="promptly-btn-icon close" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>


          <div className="promptly-mode-row" style={{ padding: "12px 16px 0", zIndex: 10, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minWidth: 0 }}>
          <Segmented
            options={PROMPT_MODES as any}
            value={settings.defaultMode}
            onChange={(val) => {
              setSettings({...settings, defaultMode: val});
              saveSettings({ defaultMode: val });
              handleOptimize(val, settings.defaultLevel, settings.defaultStyle);
            }}
          />
          <IntensityBars
            level={settings.defaultLevel}
            onChange={(val) => {
              setSettings({...settings, defaultLevel: val});
              saveSettings({ defaultLevel: val });
              handleOptimize(settings.defaultMode, val, settings.defaultStyle);
            }}
          />
        </div>
        <Segmented
          options={PROMPT_STYLES as any}
          value={settings.defaultStyle}
          onChange={(val) => {
            setSettings({...settings, defaultStyle: val});
            saveSettings({ defaultStyle: val });
            handleOptimize(settings.defaultMode, settings.defaultLevel, val);
          }}
        />
      </div>

      <div 
        ref={bodyRef}
        onScroll={handleScroll}
        className="promptly-panel-body"
      >
        {originalTextUsed && (
          <div className="promptly-original-chip" onClick={() => {
            setText(originalTextUsed);
            setOptimizedText(null);
            setOriginalTextUsed(null);
            setShowDiff(false);
          }}>
            <span className="label">Original</span>
            <span className="text">{originalTextUsed}</span>
            <span className="x">×</span>
          </div>
        )}

        {error && (
          <div className="promptly-error" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, background: 'var(--accent-error)', color: '#fff', borderRadius: 6, fontSize: 13 }}>
            <div style={{ fontWeight: 600 }}>Optimization Failed</div>
            <div style={{ opacity: 0.9 }}>{error}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button 
                onClick={() => handleOptimize()}
                style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {isOptimizing ? (
          <div className="promptly-skeleton-container" style={{ flex: 1, minHeight: 180, display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="promptly-skeleton" style={{ width: "95%", height: 14, borderRadius: 4 }} />
            <div className="promptly-skeleton" style={{ width: "100%", height: 14, borderRadius: 4 }} />
            <div className="promptly-skeleton" style={{ width: "85%", height: 14, borderRadius: 4 }} />
            <div className="promptly-skeleton" style={{ width: "90%", height: 14, borderRadius: 4, marginTop: 12 }} />
            <div className="promptly-skeleton" style={{ width: "60%", height: 14, borderRadius: 4 }} />
            <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 8, opacity: 0.7 }}>
              <div className="promptly-orb compact promptly-loading" style={{ width: 20, height: 20, cursor: "default" }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2"/>
                  <path d="M12 6v5l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <span className="promptly-shimmer-text" style={{ fontSize: 11, fontWeight: 500 }}>Analyzing intent...</span>
            </div>
          </div>
        ) : fillingVariables ? (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg)' }}>Fill Variables</div>
            <div style={{ fontSize: 13, color: 'var(--fg-muted)', marginTop: -12 }}>
              Your prompt contains placeholders. You can fill them now or leave them blank.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
              {variables.map(variable => (
                <div key={variable} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--fg-muted)' }}>{variable}</label>
                  <input
                    type="text"
                    className="promptly-textarea"
                    style={{ minHeight: 36, padding: '8px 12px', height: 'auto' }}
                    placeholder={`Value for ${variable}...`}
                    value={variableValues[variable] || ""}
                    onChange={(e) => setVariableValues({ ...variableValues, [variable]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, position: 'relative' }}>
            {!text && !optimizedText && !isStreaming && (
              <div className="promptly-ghost">
                <span key={placeholderIdx} className="promptly-ghost-text">{PLACEHOLDERS[placeholderIdx]}</span>
              </div>
            )}

            {showDiff && optimizedText && !isStreaming ? (
              <DiffView 
                original={originalTextUsed || text} 
                optimized={optimizedText} 
                onCherryPick={(token) => {
                  setText((prev) => prev + " " + token);
                }}
              />
            ) : isStreaming ? (
              <StreamingText text={optimizedText || ""} isStreaming={isStreaming} />
            ) : (
              <textarea
                className={`promptly-textarea ${optimizedText ? 'promptly-optimized-text' : ''}`}
                value={optimizedText || text}
                onChange={(e) => {
                  if (optimizedText) setOptimizedText(e.target.value);
                  else setText(e.target.value);
                }}
                autoFocus
                style={{ flex: 1 }}
              />
            )}

            {isStreaming && (
              <div style={{ position: 'absolute', bottom: 12, left: 12, display: "flex", alignItems: "center", gap: 8, opacity: 0.9, background: 'var(--surface-raised)', padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-subtle)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10 }}>
                <div className="promptly-orb compact promptly-loading" style={{ width: 14, height: 14, cursor: "default" }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2"/>
                    <path d="M12 6v5l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </div>
                <span className="promptly-shimmer-text" style={{ fontSize: 11, fontWeight: 500, fontFamily: 'var(--font-display)' }}>Streaming...</span>
              </div>
            )}
          </div>
        )}
      </div>

      {(!isOptimizing && !isStreaming && optimizedText && !showDiff && !fillingVariables) && (
        <div style={{ padding: "0 16px 12px" }}>
          <div className="promptly-refine-box" style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface-raised)", border: "1px solid var(--border-subtle)", borderRadius: 6, padding: "4px 8px" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.6">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <input 
              type="text" 
              placeholder="Refine (e.g., 'Make it more concise')" 
              value={refinementInput}
              onChange={(e) => setRefinementInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && refinementInput.trim()) {
                  e.preventDefault();
                  handleOptimize(undefined, undefined, undefined, refinementInput.trim());
                }
              }}
              style={{ flex: 1, background: "transparent", border: "none", color: "var(--fg)", fontSize: 13, outline: "none", minWidth: 0 }}
            />
            {refinementInput.trim() && (
              <button 
                onClick={() => handleOptimize(undefined, undefined, undefined, refinementInput.trim())}
                style={{ background: "var(--primary)", color: "#fff", border: "none", borderRadius: 4, padding: "2px 8px", fontSize: 12, cursor: "pointer", fontWeight: 500 }}
              >
                Go
              </button>
            )}
          </div>
        </div>
      )}

      {(!isOptimizing && !isStreaming) && (
        <div className="promptly-action-row" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: "space-between", alignItems: "center", gap: 12, padding: "12px 16px", borderTop: "1px solid var(--border-subtle)", background: "var(--surface-base)", borderBottomLeftRadius: 12, borderBottomRightRadius: 12, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            {optimizedText && !fillingVariables && (
              <button 
                className={`promptly-compare-toggle ${showDiff ? 'active' : ''}`} 
                onClick={() => setShowDiff(!showDiff)}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M15 12V3h6v9" /><path d="M9 21v-9H3v9" /><path d="M15 15h6v6" /><path d="M9 9H3V3" />
                </svg>
                Compare
              </button>
            )}
            {!fillingVariables && meta}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', flex: "1 1 auto", minWidth: 0 }}>
            {fillingVariables ? (
              <>
                <button className="promptly-btn-secondary" onClick={() => setFillingVariables(false)}>
                  Back
                </button>
                <button className="promptly-btn-primary" onClick={handleAccept}>
                  Confirm & Insert
                </button>
              </>
            ) : optimizedText ? (
              <>
                <button className="promptly-btn-secondary" onClick={() => { setOptimizedText(null); setShowDiff(false); }} title="Discard (Cmd+D)">
                  Discard
                </button>
                <button className="promptly-btn-secondary" onClick={() => {
                  if (optimizedText) {
                    navigator.clipboard.writeText(optimizedText);
                    setToast("Copied ✓");
                    setTimeout(() => setToast(null), 2000);
                  }
                }} title="Copy to clipboard (Cmd+C)">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', marginRight: 4 }}>
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  Copy
                </button>
                <button className="promptly-btn-secondary" onClick={() => handleOptimize()} title="Generate another variation">
                  <svg className="icon-regenerate" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', marginRight: 4, verticalAlign: 'text-bottom' }}>
                    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                    <path d="M21 3v5h-5" />
                  </svg>
                  Regenerate
                </button>
                <button className="promptly-btn-primary" onClick={handleAccept} title="Insert into chat (Cmd+Enter)">
                  Insert Optimized
                </button>
              </>
            ) : (
              <button 
                className="promptly-btn-primary" 
                onClick={() => handleOptimize()}
                disabled={!text.trim()}
                style={{ width: "100%" }}
              >
                Optimize Prompt
              </button>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

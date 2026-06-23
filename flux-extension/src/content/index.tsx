import React, { Component, ErrorInfo, ReactNode } from "react";
import { createRoot } from "react-dom/client";
import promptlyStyles from "./content.css?inline";
import { detectPlatform, findAnchorElement, findInputElement, readInputText, writeInputText, PlatformConfig } from "../lib/platforms";
import { getSettings, onSettingsChanged } from "../lib/storage";
import { PromptlySettings } from '@promptly/types';
import { FloatingButton } from "./FloatingButton";
import { OptimizerPanel } from "./OptimizerPanel";
import { HistoryPanel } from "./HistoryPanel";
import { optimizePrompt } from "../lib/promptEngine";
import { useHistory } from "../lib/history";

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error?: Error }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Promptly extension crashed:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 12, background: "var(--accent-error, #f44336)", color: "white", borderRadius: 8, fontSize: 13, display: "flex", flexDirection: "column", gap: 8, pointerEvents: "auto" }}>
          <div>Proenpt encountered an error.</div>
          <button onClick={() => this.setState({ hasError: false })} style={{ background: "white", color: "#f44336", border: "none", padding: "4px 8px", borderRadius: 4, cursor: "pointer", alignSelf: "flex-start" }}>Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function bootstrap(platform: PlatformConfig) {
  // Guard: if the extension context has been invalidated (e.g. after a reload
  // while the tab was already open), chrome.runtime.id becomes undefined.
  // Attempting to call chrome.storage / chrome.runtime.getURL after this throws
  // "Extension context invalidated" and crashes the content script.
  // We bail out early so the page itself is unaffected.
  if (!chrome.runtime?.id) {
    console.warn("[Proenpt] Extension context invalidated. Refresh the tab to re-enable Proenpt.");
    return;
  }

  // Teardown any existing mount from a previous injection (happens during Vite
  // HMR / crxjs hot-reload in development). Without this, React 18 throws on
  // createRoot() being called on an already-mounted root.
  const existing = document.getElementById("promptly-prompt-optimizer-root");
  if (existing) {
    existing.remove();
  }

  const host = document.createElement("div");
  host.id = "promptly-prompt-optimizer-root";
  host.setAttribute("data-theme", window.location.hostname.replace(/^www\./, ''));
  host.style.position = "fixed";
  host.style.top = "0";
  host.style.left = "0";
  host.style.zIndex = "2147483647";
  host.style.pointerEvents = "none";
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = promptlyStyles;
  shadow.appendChild(style);

  const mount = document.createElement("div");
  shadow.appendChild(mount);

  const root = createRoot(mount);
  root.render(
    <ErrorBoundary>
      <PromptlyApp platform={platform} />
    </ErrorBoundary>
  );
}

const Toast: React.FC<{ message: string, type: 'error' | 'success' | 'info', onClose: () => void }> = ({ message, type, onClose }) => {
  return (
    <div className={`promptly-toast promptly-toast-${type}`}>
      <span>{message}</span>
      <button onClick={onClose} aria-label="Close" className="promptly-toast-close">&times;</button>
    </div>
  );
};

const PromptlyApp: React.FC<{ platform: PlatformConfig }> = ({ platform }) => {
  const [position, setPosition] = React.useState<{ top: number; left: number } | null>(null);
  const [orbOffset, setOrbOffset] = React.useState<{ x: number, y: number }>({ x: 0, y: 0 });
  const [open, setOpen] = React.useState(false);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [originalText, setOriginalText] = React.useState("");
  const [currentInputText, setCurrentInputText] = React.useState("");
  const [settings, setSettings] = React.useState<PromptlySettings | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [orbLoading, setOrbLoading] = React.useState(false);
  
  const [showOnboarding, setShowOnboarding] = React.useState(false);
  const [toast, setToast] = React.useState<{ message: string, type: 'error' | 'success' | 'info' } | null>(null);
  
  const inputRef = React.useRef<HTMLElement | null>(null);
  const history = useHistory();

  const showToast = (message: string, type: 'error' | 'success' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  React.useEffect(() => {
    getSettings().then(setSettings);
    onSettingsChanged(setSettings);

    chrome.storage.local.get(['hasSeenOnboarding'], (res) => {
      if (!res.hasSeenOnboarding) {
        setShowOnboarding(true);
        chrome.storage.local.set({ hasSeenOnboarding: true });
      }
    });
  }, []);

  // Drain pending history whenever we get a valid access token
  React.useEffect(() => {
    if (settings?.accessToken && settings?.apiBaseUrl) {
      useHistory.getState().drainPendingQueue({ 
        accessToken: settings.accessToken, 
        apiBaseUrl: settings.apiBaseUrl 
      });
    }
  }, [settings?.accessToken, settings?.apiBaseUrl]);

  React.useEffect(() => {
    const update = () => {
      const input = findInputElement(platform);
      const anchor = findAnchorElement(platform) ?? input;
      inputRef.current = input;
      if (!anchor) {
        setPosition(null);
        return;
      }
      if (input) {
        setCurrentInputText(readInputText(input));
      }
      const rect = anchor.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        setPosition(null);
        return;
      }
      const orbSize = 40;
      const margin = 8;
      const desiredTop = rect.top + rect.height / 2 - orbSize / 2;
      const newTop = Math.max(margin, Math.min(desiredTop, window.innerHeight - orbSize - margin));
      const desiredLeft = rect.right + 10;
      const newLeft = Math.max(margin, Math.min(desiredLeft, window.innerWidth - orbSize - margin));
      setPosition((prev) => {
        if (prev?.top === newTop && prev?.left === newLeft) return prev;
        return { top: newTop, left: newLeft };
      });
    };

    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const interval = window.setInterval(update, 1000);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.clearInterval(interval);
    };
  }, [platform]);

  const [customPosition, setCustomPosition] = React.useState<{ top: number; left: number } | null>(null);

  React.useEffect(() => {
    const onMessage = (msg: any) => {
      if (msg?.type === "PROMPTLY_TRIGGER_OPTIMIZE") {
        openPanel();
      } else if (msg?.type === "PROMPTLY_TRIGGER_AUTO_OPTIMIZE") {
        handleDoubleClick();
      }
    };
    chrome.runtime.onMessage.addListener(onMessage);

    const onKeyDown = (e: KeyboardEvent) => {
      // Trigger auto-optimize on Alt+Shift+Y or Cmd+Shift+Y
      if ((e.altKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        e.stopPropagation();
        handleDoubleClick();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      chrome.runtime.onMessage.removeListener(onMessage);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [settings]);

  const openPanel = () => {
    const input = findInputElement(platform);
    if (!input) return;
    try {
      setOriginalText(readInputText(input));
    } catch (e) {
      console.warn("Promptly: Failed to read input text", e);
      setOriginalText("");
    }
    setCustomPosition(null);
    setOpen(true);
    setShowOnboarding(false);
  };

  const playSuccessSound = () => {
    // Subtle, muted "pop" sound using base64
    const audio = new Audio("data:audio/mp3;base64,//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq");
    audio.volume = 0.2;
    audio.play().catch(() => {});
  };

  const handleReplace = async (text: string) => {
    setOpen(false);
    setSuccess(true);
    playSuccessSound();
    setTimeout(() => setSuccess(false), 800);

    const input = inputRef.current ?? findInputElement(platform);
    if (!input) return;

    writeInputText(input, text);
  };

  const lastAutoRef = React.useRef<{ original: string, optimized: string } | null>(null);

  function normalizeForCompare(s: string): string {
    return s.trim()
      .replace(/[\u201c\u201d]/g, '"')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/\r\n/g, "\n")
      .replace(/[\u00a0\u200b]/g, " ")
      .replace(/\s+/g, " ");
  }

  const handleDoubleClick = async () => {
    const input = findInputElement(platform);
    if (!input || !settings) return;

    let textToOptimize = "";
    try {
      textToOptimize = readInputText(input);
    } catch (e) {
      console.warn("Promptly: Failed to read input text for auto-optimization", e);
      return;
    }

    let isRegenerating = false;
    if (lastAutoRef.current && normalizeForCompare(textToOptimize) === normalizeForCompare(lastAutoRef.current.optimized)) {
      textToOptimize = lastAutoRef.current.original;
      isRegenerating = true;
      showToast("Regenerating from your original input...", "info");
    }

    if (!textToOptimize.trim()) {
      showToast("Please type a prompt first before auto-optimizing!", "error");
      return;
    }

    setOrbLoading(true);

    try {
      // FIX 3.16: Respect the user's chosen level. Previously "light" was silently
      // upgraded to "aggressive", which contradicts the UI and charges higher quota.
      // Only fall back if no level is set at all.
      const level = settings.defaultLevel || "medium";

      if (!isRegenerating && settings.defaultMode === "auto") {
        showToast("Auto-detecting mode...", "info");
      }

      const result = await optimizePrompt({
        text: textToOptimize,
        ...(isRegenerating && lastAutoRef.current
          ? { 
              previousPrompt: lastAutoRef.current.optimized, 
              refinement: "Produce a structurally different rewrite. Use a different section ordering, a different opening framing, and avoid reusing the exact phrasing or headings from the previous version. Keep the same intent." 
            }
          : {}),
        mode: settings.defaultMode || "auto",
        level,
        style: settings.defaultStyle || "neutral",
        context: settings.contextInjectionEnabled ? settings.contextProfile : undefined,
        stream: false,
        platform: window.location.hostname
      }, {
        apiBaseUrl: settings.apiBaseUrl,
        apiKey: settings.apiKey,
        categorizerApiUrl: settings.categorizerApiUrl,
        categorizerApiKey: settings.categorizerApiKey,
        accessToken: settings.accessToken
      });

      if (result.degraded) {
        showToast(`Optimized with local fallback (lower quality): ${result.degradedReason}`, "info");
      }

      writeInputText(input, result.optimized);

      // Direct server sync — don't depend on history store auth state
      const token = settings.accessToken;
      const API_BASE = process.env.NODE_ENV === "production" ? "https://proenpt.vercel.app" : "http://localhost:3000";
      
      if (token) {
        fetch(`${API_BASE}/api/history`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            originalPrompt: textToOptimize,
            optimizedPrompt: result.optimized,
            platformUsed: window.location.hostname,
            promptMode: settings.defaultMode || "auto",
            rewriteLevel: level
          })
        }).catch(e => console.warn("[Promptly] Server sync failed:", e));
      }

      history.add({
        text: textToOptimize,
        optimized: result.optimized,
        mode: "auto",
        level,
        platform: window.location.hostname,
        source: result.source as any
      }, { accessToken: settings.accessToken, apiBaseUrl: settings.apiBaseUrl });

      lastAutoRef.current = { original: textToOptimize, optimized: result.optimized };

      setSuccess(true);
      playSuccessSound();
      setTimeout(() => setSuccess(false), 800);
    } catch (err: any) {
      console.error("Promptly Auto-Optimize failed:", err);
      showToast(`Optimization failed: ${err.message || err}`, "error");
    } finally {
      setOrbLoading(false);
    }
  };

  if (!position || !settings) return null;

  const panelWidth = 480;
  const panelMaxHeight = 520;
  const margin = 16;
  const orbSize = 36;

  const orbTop = position.top + orbOffset.y;
  const orbLeft = position.left + orbOffset.x;

  let panelTop: number = orbTop;
  let panelLeft: number = orbLeft + orbSize + 10;

  if (orbTop + panelMaxHeight > window.innerHeight) {
    const overflow = orbTop + panelMaxHeight - window.innerHeight + margin;
    panelTop = Math.max(margin, orbTop - overflow);
  }

  if (orbLeft + orbSize + 10 + panelWidth > window.innerWidth) {
    panelLeft = orbLeft - panelWidth - 10;
  }

  const finalTop = customPosition ? customPosition.top : panelTop;
  const finalLeft = customPosition ? customPosition.left : panelLeft;

  let promptState: "idle" | "vague" | "ready" = "idle";
  if (currentInputText.length > 5 && currentInputText.length < 30) promptState = "vague";
  else if (currentInputText.length >= 30) promptState = "ready";

  return (
    <>
      <DraggableOrb 
        top={orbTop} 
        left={orbLeft} 
        onDrag={(dy, dx) => setOrbOffset(prev => ({ y: prev.y + dy, x: prev.x + dx }))}
      >
        <FloatingButton 
          loading={orbLoading} 
          active={open} 
          promptState={promptState} 
          onClick={() => (open ? setOpen(false) : openPanel())} 
          onDoubleClick={handleDoubleClick}
          success={success} 
        />
        {showOnboarding && (
          <div className="promptly-onboarding-tooltip">
            <strong>Welcome to Proenpt!</strong>
            <p>Click once to refine, double-click to auto-optimize, Ctrl+Shift+P to open, Alt+Shift+Y to auto-optimize.</p>
            <button onClick={() => setShowOnboarding(false)}>Got it</button>
          </div>
        )}
      </DraggableOrb>
      
      {open && (
        <DraggablePanel 
          initialTop={finalTop} 
          initialLeft={finalLeft} 
          onDrag={(top, left) => setCustomPosition({ top, left })}
        >
          <OptimizerPanel
            initialText={originalText}
            onReplace={handleReplace}
            onClose={() => setOpen(false)}
            onOpenHistory={() => {
              setOpen(false);
              setHistoryOpen(true);
            }}
          />
        </DraggablePanel>
      )}
      
      <HistoryPanel
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onSelect={(entry) => {
          setOriginalText(entry.text);
          setOpen(true);
        }}
      />
      
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </>
  );
};

const DraggableOrb: React.FC<{
  top: number;
  left: number;
  onDrag: (dy: number, dx: number) => void;
  children: React.ReactNode;
}> = ({ top, left, onDrag, children }) => {
  const [isDragging, setIsDragging] = React.useState(false);
  const dragStart = React.useRef<{ x: number, y: number } | null>(null);
  const hasMoved = React.useRef(false);

  React.useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (dragStart.current) {
        const dx = e.clientX - dragStart.current.x;
        const dy = e.clientY - dragStart.current.y;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          setIsDragging(true);
          hasMoved.current = true;
          onDrag(dy, dx);
          dragStart.current = { x: e.clientX, y: e.clientY };
        }
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (isDragging) {
        setTimeout(() => setIsDragging(false), 50);
      }
      dragStart.current = null;
      // FIX 3.9: Reset hasMoved so the next click (after drag ends) is not swallowed.
      hasMoved.current = false;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [onDrag, isDragging]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    dragStart.current = { x: e.clientX, y: e.clientY };
    // FIX 3.9: Reset hasMoved so clicks work again after a prior drag.
    hasMoved.current = false;
  };

  return (
    <div 
      style={{ 
        position: "fixed", 
        top,
        left,
        pointerEvents: "auto",
        zIndex: 2147483647
      }}
      draggable={false}
      onPointerDown={handlePointerDown}
      onClickCapture={(e) => {
        if (hasMoved.current) {
          e.stopPropagation();
          e.preventDefault();
        }
      }}
    >
      {children}
    </div>
  );
};

const DraggablePanel: React.FC<{
  initialTop: number;
  initialLeft: number;
  onDrag: (top: number, left: number) => void;
  children: React.ReactNode;
}> = ({ initialTop, initialLeft, onDrag, children }) => {
  const [isDragging, setIsDragging] = React.useState(false);
  const dragStart = React.useRef<{ x: number, y: number, startTop: number, startLeft: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.promptly-header') && !target.closest('button') && !target.closest('select')) {
      setIsDragging(true);
      dragStart.current = {
        x: e.clientX,
        y: e.clientY,
        startTop: initialTop,
        startLeft: initialLeft
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDragging && dragStart.current) {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      onDrag(dragStart.current.startTop + dy, dragStart.current.startLeft + dx);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false);
      dragStart.current = null;
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  return (
    <div 
      style={{ 
        position: "fixed", 
        top: initialTop,
        left: initialLeft,
        pointerEvents: "auto",
        zIndex: 2147483647
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {children}
    </div>
  );
};

(() => {
  // Bail out immediately if the extension context is already invalidated.
  // This can happen if the extension was reloaded/updated while this tab
  // was open and the old content script is still running.
  if (typeof chrome === "undefined" || !chrome.runtime?.id) return;

  const platform = detectPlatform(window.location.hostname);
  if (platform) {
    bootstrap(platform);
  }
})();

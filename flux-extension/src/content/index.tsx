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
          <div>Promptly encountered an error.</div>
          <button onClick={() => this.setState({ hasError: false })} style={{ background: "white", color: "#f44336", border: "none", padding: "4px 8px", borderRadius: 4, cursor: "pointer", alignSelf: "flex-start" }}>Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function bootstrap(platform: PlatformConfig) {
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

const PromptlyApp: React.FC<{ platform: PlatformConfig }> = ({ platform }) => {
  const [position, setPosition] = React.useState<{ top: number; left: number } | null>(null);
  const [open, setOpen] = React.useState(false);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [originalText, setOriginalText] = React.useState("");
  const [currentInputText, setCurrentInputText] = React.useState("");
  const [settings, setSettings] = React.useState<PromptlySettings | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [orbLoading, setOrbLoading] = React.useState(false);
  const inputRef = React.useRef<HTMLElement | null>(null);

  const history = useHistory();

  React.useEffect(() => {
    getSettings().then(setSettings);
    onSettingsChanged(setSettings);
  }, []);

  // Locate the chat input and position the button beside it.
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
      // Vertically center the orb on the input's midpoint, but clamp to viewport
      const desiredTop = rect.top + rect.height / 2 - orbSize / 2;
      const newTop = Math.max(margin, Math.min(desiredTop, window.innerHeight - orbSize - margin));
      // Horizontally place to the right of the input, but clamp to viewport
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

  // Keyboard shortcut + background message handler
  React.useEffect(() => {
    const onMessage = (msg: any) => {
      if (msg?.type === "PROMPTLY_TRIGGER_OPTIMIZE") {
        openPanel();
      }
    };
    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
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
    setCustomPosition(null); // Reset position on open
    setOpen(true);
  };

  const handleReplace = async (text: string) => {
    setOpen(false);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 800);

    const input = inputRef.current ?? findInputElement(platform);
    if (!input) return;

    // Insert text directly to avoid breaking complex React/contenteditable inputs
    writeInputText(input, text);
  };

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

    if (!textToOptimize.trim()) {
      alert("Please type a prompt first before auto-optimizing!");
      return;
    }

    setOrbLoading(true);

    try {
      const result = await optimizePrompt({
        text: textToOptimize,
        mode: "auto", // Auto-detect mode
        level: settings.defaultLevel || "medium", // Continue using user's configured level
        style: settings.defaultStyle || "neutral", // Continue using user's configured style
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

      // Write result directly into input
      writeInputText(input, result.optimized);

      // Add optimized prompt to history
      history.add({
        text: textToOptimize,
        optimized: result.optimized,
        mode: "auto",
        level: settings.defaultLevel || "medium",
        platform: window.location.hostname,
        source: result.source as any
      });

      // Success feedback animation
      setSuccess(true);
      setTimeout(() => setSuccess(false), 800);
    } catch (err: any) {
      console.error("Promptly Auto-Optimize failed:", err);
      alert(`Promptly Auto-Optimize failed: ${err.message || err}`);
    } finally {
      setOrbLoading(false);
    }
  };

  if (!position || !settings) return null;

  const panelWidth = 480;
  const panelMaxHeight = 520;
  const margin = 16;
  const orbSize = 36; // the promptly-orb size

  let panelTop: number = position.top;
  let panelLeft: number = position.left + orbSize + 10;

  // Clamp vertically if it goes off the bottom of the screen
  if (position.top + panelMaxHeight > window.innerHeight) {
    const overflow = position.top + panelMaxHeight - window.innerHeight + margin;
    panelTop = Math.max(margin, position.top - overflow);
  }

  // Clamp horizontally if it goes off the right of the screen
  if (position.left + orbSize + 10 + panelWidth > window.innerWidth) {
    // Render to the left of the orb instead
    panelLeft = position.left - panelWidth - 10;
  }

  // Use custom position if user has dragged
  const finalTop = customPosition ? customPosition.top : panelTop;
  const finalLeft = customPosition ? customPosition.left : panelLeft;

  let promptState: "idle" | "vague" | "ready" = "idle";
  if (currentInputText.length > 5 && currentInputText.length < 30) promptState = "vague";
  else if (currentInputText.length >= 30) promptState = "ready";

  return (
    <>
      <div style={{ position: "fixed", top: position.top, left: position.left, pointerEvents: "auto", zIndex: 2147483647 }}>
        <FloatingButton 
          loading={orbLoading} 
          active={open} 
          promptState={promptState} 
          onClick={() => (open ? setOpen(false) : openPanel())} 
          onDoubleClick={handleDoubleClick}
          success={success} 
        />
      </div>
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
            onOpenHistory={() => setHistoryOpen(true)}
          />
        </DraggablePanel>
      )}
      <HistoryPanel
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onSelect={(entry) => {
          setOriginalText(entry.text);
          setOpen(true);
          // To fully support loading 'optimized' we would need to pass it to OptimizerPanel
        }}
      />
    </>
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
    // Only drag if clicking the header area
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

// Execute bootstrap after all declarations are processed
(() => {
  const platform = detectPlatform(window.location.hostname);
  if (platform) {
    bootstrap(platform);
  }
})();

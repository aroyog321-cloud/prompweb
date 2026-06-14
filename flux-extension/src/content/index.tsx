import React from "react";
import { createRoot } from "react-dom/client";
import fluxStyles from "./content.css?inline";
import { detectPlatform, findAnchorElement, findInputElement, readInputText, writeInputText, PlatformConfig } from "../lib/platforms";
import { getSettings, onSettingsChanged } from "../lib/storage";
import { FluxSettings } from "../lib/types";
import { FloatingButton } from "./FloatingButton";
import { OptimizerPanel } from "./OptimizerPanel";

function bootstrap(platform: PlatformConfig) {
  const host = document.createElement("div");
  host.id = "flux-prompt-optimizer-root";
  host.style.position = "fixed";
  host.style.top = "0";
  host.style.left = "0";
  host.style.zIndex = "2147483647";
  host.style.pointerEvents = "none";
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = fluxStyles;
  shadow.appendChild(style);

  const mount = document.createElement("div");
  shadow.appendChild(mount);

  const root = createRoot(mount);
  root.render(<FluxApp platform={platform} />);
}

const FluxApp: React.FC<{ platform: PlatformConfig }> = ({ platform }) => {
  const [position, setPosition] = React.useState<{ top: number; left: number } | null>(null);
  const [open, setOpen] = React.useState(false);
  const [originalText, setOriginalText] = React.useState("");
  const [settings, setSettings] = React.useState<FluxSettings | null>(null);
  const inputRef = React.useRef<HTMLElement | null>(null);

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
      if (msg?.type === "FLUX_TRIGGER_OPTIMIZE") {
        openPanel();
      }
    };
    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
  }, [settings]);

  const openPanel = () => {
    const input = findInputElement(platform);
    if (!input) return;
    setOriginalText(readInputText(input));
    setCustomPosition(null); // Reset position on open
    setOpen(true);
  };

  const handleReplace = async (text: string) => {
    setOpen(false);
    const input = inputRef.current ?? findInputElement(platform);
    if (!input) return;

    // Smooth typewriter effect
    let currentText = "";
    writeInputText(input, currentText);
    
    const chunkSize = Math.max(1, Math.floor(text.length / 25)); // Write in chunks to keep it fast but visible
    
    for (let i = 0; i < text.length; i += chunkSize) {
      currentText += text.substring(i, i + chunkSize);
      writeInputText(input, currentText);
      await new Promise(r => setTimeout(r, 10)); // ~250ms total duration
    }
    
    // Ensure final text is exactly correct
    writeInputText(input, text);
  };

  if (!position || !settings) return null;

  const panelWidth = 400;
  const panelMaxHeight = 520;
  const margin = 16;
  const orbSize = 36; // the flux-orb size

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

  return (
    <>
      <div style={{ position: "fixed", top: position.top, left: position.left, pointerEvents: "auto", zIndex: 2147483647 }}>
        <FloatingButton loading={false} active={open} onClick={() => (open ? setOpen(false) : openPanel())} />
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
          />
        </DraggablePanel>
      )}
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
    if (target.closest('.flux-header') && !target.closest('button') && !target.closest('select')) {
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
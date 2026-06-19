# Promptly Prompt Optimizer - Positioning Fix and UI/UX Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the dialog box going out of screen issue and implement next-level UI/UX enhancements for the Promptly Prompt Optimizer Chrome extension.

**Architecture:** 
- Fix positioning logic in content script to ensure panel stays within viewport boundaries
- Enhance visual design with glassmorphism, micro-interactions, and improved theming
- Add usability features like keyboard navigation, position memory, and history panel
- Implement performance optimizations including debouncing and caching
- Maintain backward compatibility and follow existing code patterns

**Tech Stack:**
- React 18, TypeScript, Vite with @crxjs/vite-plugin
- Chrome Extension Manifest V3
- TailwindCSS for styling
- Zustand for state management (if needed)
- Local storage for persisting user preferences

---

## Phase 1: Critical Bug Fix - Positioning

### Task 1: Analyze Current Positioning Logic

**Files:**
- Read: `promptly-extension/src/content/index.tsx`

- [ ] **Step 1: Examine current positioning implementation**

```typescript
// Look at the useEffect that handles positioning (lines 45-86 in index.tsx)
// Note how orb positioning is calculated and clamped
// Note how panel positioning uses isOffscreen boolean
```

- [ ] **Step 2: Run extension to reproduce issue**

Run: `cd promptly-extension && npm run dev`
Expected: Extension loads in Chrome, orb positions correctly, but panel overflows when near screen edges

- [ ] **Step 3: Document specific overflow scenarios**

```markdown
Scenarios where overflow occurs:
1. When orb is positioned near right edge - panel extends beyond right viewport
2. When orb is positioned near left edge - panel extends beyond left viewport  
3. When orb is positioned near bottom edge - panel extends beyond bottom viewport
4. When orb is positioned near top edge - panel extends beyond top viewport
```

- [ ] **Step 4: Commit analysis**

```bash
git add docs/superpowers/plans/2026-06-13-promptly-extension-fixes-and-enhancements.md
git commit -m "docs: analyze positioning issue for Promptly extension"
```

### Task 2: Implement Enhanced Boundary Detection for Positioning

**Files:**
- Modify: `promptly-extension/src/content/index.tsx`

- [ ] **Step 1: Add panel position state**

```typescript
const [panelPosition, setPanelPosition] = React.useState<{ top: number; left: number } | null>(null);
```

- [ ] **Step 2: Replace existing positioning logic with boundary-aware implementation**

```typescript
// Locate the useEffect starting at line 45 and replace the update function
const update = () => {
  const input = findInputElement(platform);
  const anchor = findAnchorElement(platform) ?? input;
  inputRef.current = input;
  
  if (!anchor) {
    setPosition(null);
    setPanelPosition(null);
    return;
  }

  const rect = anchor.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    setPosition(null);
    setPanelPosition(null);
    return;
  }

  const orbSize = 40;
  const margin = 8;
  const panelWidth = 380; // From OptimizerPanel styles
  const panelHeight = Math.min(500, window.innerHeight * 0.8); // Estimated max height

  // Horizontally position orb with smarter boundary detection
  const desiredLeft = rect.right + 10;
  const newLeft = Math.max(
    margin, 
    Math.min(
      desiredLeft, 
      window.innerWidth - orbSize - margin
    )
  );

  // Vertically position orb (existing logic is good)
  const desiredTop = rect.top + rect.height / 2 - orbSize / 2;
  const newTop = Math.max(
    margin, 
    Math.min(
      desiredTop, 
      window.innerHeight - orbSize - margin
    )
  );

  // Calculate panel position with boundary awareness
  let panelLeft, panelTop;
  
  // Horizontal panel placement
  if (newLeft + orbSize/2 + margin + panelWidth > window.innerWidth) {
    // Not enough space on right, place on left
    panelLeft = newLeft - panelWidth - margin - orbSize/2;
  } else {
    // Place on right
    panelLeft = newLeft + orbSize/2 + margin;
  }
  
  // Ensure panel stays within horizontal bounds
  panelLeft = Math.max(margin, Math.min(panelLeft, window.innerWidth - panelWidth - margin));

  // Vertical panel placement (align with orb center, but check boundaries)
  const desiredPanelTop = newTop + orbSize/2 - panelHeight/2;
  panelTop = Math.max(
    margin, 
    Math.min(
      desiredPanelTop, 
      window.innerHeight - panelHeight - margin
    )
  );

  setPosition({ top: newTop, left: newLeft });
  setPanelPosition({ top: panelTop, left: panelLeft });
};
```

- [ ] **Step 3: Update render logic to use panelPosition**

```typescript
// Replace the positioning div (lines 118-132) with:
{open && panelPosition ? (
  <div 
    style={{ 
      position: "fixed", 
      top: panelPosition.top, 
      left: panelPosition.left, 
      pointerEvents: "auto" 
    }}
  >
    <OptimizerPanel
      originalText={originalText}
      settings={settings}
      platformName={platform.name}
      accent={platform.accent}
      onReplace={handleReplace}
      onClose={() => setOpen(false)}
    />
  </div>
) : null}
```

- [ ] **Step 4: Test the fix**

Run: `cd promptly-extension && npm run dev`
Expected: Orb positions correctly, panel never overflows viewport in any scenario

- [ ] **Step 5: Commit fix**

```bash
git add promptly-extension/src/content/index.tsx
git commit -m "fix: implement boundary-aware positioning for Promptly extension panel"
```

## Phase 2: Visual & Usability Improvements

### Task 3: Enhance Visual Design with Glassmorphism

**Files:**
- Modify: `promptly-extension/src/content/content.css`
- Modify: `promptly-extension/src/content/OptimizerPanel.tsx`

- [ ] **Step 1: Update CSS variables for enhanced glassmorphism**

```css
/* Add to content.css */
.promptly-panel {
  background: rgba(15, 15, 22, 0.7) !important; /* More transparent */
  backdrop-filter: blur(20px) saturate(180%) !important;
  -webkit-backdrop-filter: blur(20px) saturate(180%) !important;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.125) !important;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2) !important;
}

/* Add gradient animation */
@keyframes gradientShift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.promptly-panel:hover {
  background: rgba(15, 15, 22, 0.75) !important;
  animation: gradientShift 8s ease infinite;
}
```

- [ ] **Step 2: Apply enhanced styles to OptimizerPanel**

```typescript
// In OptimizerPanel.tsx, update the main div style
<div
  className="promptly-panel"
  style={{
    width: 380,
    maxWidth: "90vw",
    maxHeight: "90vh", // Increased from 80vh
    display: "flex",
    flexDirection: "column",
    borderRadius: 16,
    background: "rgba(15,15,22,0.7)", // More transparent
    backdropFilter: "blur(20px) saturate(180%)",
    WebkitBackdropFilter: "blur(20px) saturate(180%)",
    border: "1px solid rgba(255,255,255,0.125)",
    boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
    color: "#F2F2F8",
    overflow: "hidden",
    position: "relative"
  }}
>
```

- [ ] **Step 3: Add hover effects to buttons**

```typescript
// Update button styles in OptimizerPanel.tsx
const primaryButtonStyle: React.CSSProperties = {
  flex: 1,
  background: "linear-gradient(135deg,#4FE6E0,#8B6CFF,#FF5FB8)",
  color: "#0B0B12",
  border: "none",
  borderRadius: 10,
  padding: "9px 12px",
  fontWeight: 600,
  fontSize: 12.5,
  cursor: "pointer",
  transition: "all 0.2s ease",
  transform: "translateY(0)",
  "&:hover": {
    transform: "translateY(-2px)",
    boxShadow: "0 4px 12px rgba(79, 230, 224, 0.3)"
  },
  "&:active": {
    transform: "translateY(0)"
  }
};

// Similar updates for secondary buttons
```

- [ ] **Step 4: Test visual enhancements**

Run: `cd promptly-extension && npm run dev`
Expected: Panel has enhanced glassmorphism effect, subtle animations on hover

- [ ] **Step 5: Commit visual improvements**

```bash
git add promptly-extension/src/content/content.css promptly-extension/src/content/OptimizerPanel.tsx
git commit -m "style: enhance glassmorphism and visual effects"
```

### Task 4: Implement Keyboard Navigation and Accessibility

**Files:**
- Modify: `promptly-extension/src/content/OptimizerPanel.tsx`

- [ ] **Step 1: Add keyboard event handlers**

```typescript
// Add to OptimizerPanel component
const handleKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === "Escape") {
    onClose();
    e.preventDefault();
  }
  
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
    if (result?.optimized) {
      onReplace(result.optimized);
      e.preventDefault();
    }
  }
  
  // Tab navigation improvements
  if (e.key === "Tab") {
    // Prevent tabbing out of panel when open
    // Focus management logic would go here
  }
};

// Add to useEffect for keyboard listener
React.useEffect(() => {
  const handleKey = (e: KeyboardEvent) => {
    if (open && e.key === "Escape") {
      onClose();
    }
  };
  
  window.addEventListener("keydown", handleKey);
  return () => window.removeEventListener("keydown", handleKey);
}, [open, onClose]);
```

- [ ] **Step 2: Improve ARIA labels and accessibility**

```typescript
// Add to OptimizerPanel props and usage
interface OptimizerPanelProps {
  // ... existing props
  "aria-label": string; // Add ARIA label
}

// Update the main div
<div
  className="promptly-panel"
  role="dialog"
  "aria-modal"="true"
  "aria-labelledby"="promptly-panel-title"
  // ... existing styles
>
```

- [ ] **Step 3: Add focus trapping for modal behavior**

```typescript
// Add refs for first and last focusable elements
const firstFocusableRef = React.useRef<HTMLElement | null>(null);
const lastFocusableRef = React.useRef<HTMLElement | null>(null);

// In JSX, attach refs to first and last interactive elements
<select 
  ref={firstFocusableRef}
  // ... existing props
>
<button 
  ref={lastFocusableRef}
  onClick={onReplace}
  // ... existing props
>
Replace in chat
</button>

// Add focus trap effect
React.useEffect(() => {
  if (!open) return;
  
  const handleTab = (e: KeyboardEvent) => {
    if (e.key !== "Tab") return;
    
    const focusableElements = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ) || []
    );
    
    const first = focusableElements[0];
    const last = focusableElements[focusableElements.length - 1];
    
    if (e.shiftLeft) { // Shift + Tab
      if (document.activeElement === first) {
        last.focus();
        e.preventDefault();
      }
    } else { // Tab
      if (document.activeElement === last) {
        first.focus();
        e.preventDefault();
      }
    }
  };
  
  document.addEventListener("keydown", handleTab);
  return () => document.removeEventListener("keydown", handleTab);
}, [open]);
```

- [ ] **Step 4: Test keyboard navigation**

Run: `cd promptly-extension && npm run dev`
Expected: 
- ESC closes panel
- Ctrl/Cmd+Enter replaces text
- Tab navigates between controls
- Shift+Tab reverses tab order
- Focus stays trapped within panel when open

- [ ] **Step 5: Commit accessibility improvements**

```bash
git add promptly-extension/src/content/OptimizerPanel.tsx
git commit -m "feat: add keyboard navigation and accessibility improvements"
```

### Task 5: Implement Position Memory Feature

**Files:**
- Modify: `promptly-extension/src/lib/storage.ts`
- Modify: `promptly-extension/src/content/index.tsx`

- [ ] **Step 1: Extend settings interface for position memory**

```typescript
// In storage.ts, update PromptlySettings interface
export interface PromptlySettings {
  theme: "dark" | "light" | "system";
  defaultMode: PromptMode;
  defaultLevel: RewriteLevel;
  shortcutEnabled: boolean;
  apiBaseUrl: string;
  apiKey?: string;
  contextProfile: ContextProfile;
  contextInjectionEnabled: boolean;
  // New position memory fields
  rememberPanelPosition: boolean;
  panelPositions: Record<string, { top: number; left: number }>; // hostname -> position
}
```

- [ ] **Step 2: Update DEFAULT_SETTINGS**

```typescript
export const DEFAULT_SETTINGS: PromptlySettings = {
  theme: "dark",
  defaultMode: "general",
  defaultLevel: "medium",
  shortcutEnabled: true,
  apiBaseUrl: "http://localhost:3000",
  apiKey: "",
  contextProfile: {},
  contextInjectionEnabled: false,
  rememberPanelPosition: true, // Enable by default
  panelPositions: {}
};
```

- [ ] **Step 3: Modify settings loading/saving to handle new fields**

```typescript
// In getSettings function
export async function getSettings(): Promise<PromptlySettings> {
  const result = await chrome.storage.sync.get(STORAGE_KEY);
  const stored = result[STORAGE_KEY] as Partial<PromptlySettings> | undefined;
  return { 
    ...DEFAULT_SETTINGS, 
    ...stored, 
    contextProfile: { 
      ...DEFAULT_SETTINGS.contextProfile, 
      ...(stored?.contextProfile ?? {}) 
    },
    panelPositions: {
      ...DEFAULT_SETTINGS.panelPositions,
      ...(stored?.panelPositions ?? {})
    }
  };
}

// In setSettings function
export async function setSettings(partial: Partial<PromptlySettings>): Promise<PromptlySettings> {
  const current = await getSettings();
  const next: PromptlySettings = {
    ...current,
    ...partial,
    contextProfile: { 
      ...current.contextProfile, 
      ...(partial.contextProfile ?? {}) 
    },
    panelPositions: {
      ...current.panelPositions,
      ...(partial.panelPositions ?? {})
    }
  };
  await chrome.storage.sync.set({ [STORAGE_KEY]: next });
  return next;
}
```

- [ ] **Step 4: Implement position saving and loading in content script**

```typescript
// In index.tsx, add position memory logic
React.useEffect(() => {
  // Load saved position for this hostname when settings update
  if (settings?.rememberPanelPosition && settings.panelPositions[window.location.hostname]) {
    const savedPos = settings.panelPositions[window.location.hostname];
    // Validate position is still within viewport
    if (savedPos.left >= 0 && 
        savedPos.top >= 0 && 
        savedPos.left + 380 <= window.innerWidth && 
        savedPos.top + 200 <= window.innerHeight) {
      setPanelPosition(savedPos);
    }
  }
}, [settings]);

// Save position when panel is moved or resized
React.useEffect(() => {
  if (!settings?.rememberPanelPosition || !panelPosition) return;
  
  const handlePositionChange = () => {
    if (panelPosition) {
      // Save current position
      chrome.storage.sync.get(STORAGE_KEY, (result) => {
        const stored = result[STORAGE_KEY] as Partial<PromptlySettings> | undefined;
        const updatedSettings: PromptlySettings = {
          ...DEFAULT_SETTINGS,
          ...(stored ?? {}),
          panelPositions: {
            ...(stored?.panelPositions ?? {}),
            [window.location.hostname]: panelPosition
          }
        };
        chrome.storage.sync.set({ [STORAGE_KEY]: updatedSettings });
      });
    }
  };
  
  // Listen for position changes (would need to implement drag or resize listeners)
  // For now, save on panel open/close and window resize
  window.addEventListener("resize", handlePositionChange);
  
  return () => window.removeEventListener("resize", handlePositionChange);
}, [settings, panelPosition]);
```

- [ ] **Step 5: Test position memory**

Run: `cd promptly-extension && npm run dev`
Expected: 
- Panel position is saved per hostname
- Panel opens in last used position on same site
- Position respects viewport boundaries
- Works across browser sessions

- [ ] **Step 6: Commit position memory feature**

```bash
git add promptly-extension/src/lib/storage.ts promptly-extension/src/content/index.tsx
git commit -m "feat: implement panel position memory per hostname"
```

## Phase 3: Feature Enhancements

### Task 6: Add History Panel

**Files:**
- Create: `promptly-extension/src/content/HistoryPanel.tsx`
- Modify: `promptly-extension/src/content/index.tsx`
- Modify: `promptly-extension/src/lib/storage.ts`

- [ ] **Step 1: Extend settings for history storage**

```typescript
// In storage.ts, add to PromptlySettings
export interface PromptlySettings {
  // ... existing fields
  maxHistoryItems: number; // Default 50
  historyEnabled: boolean; // Default true
}
```

- [ ] **Step 2: Update DEFAULT_SETTINGS**

```typescript
export const DEFAULT_SETTINGS: PromptlySettings = {
  // ... existing fields
  maxHistoryItems: 50,
  historyEnabled: true
};
```

- [ ] **Step 3: Create HistoryPanel component**

```typescript
// Create promptly-extension/src/content/HistoryPanel.tsx
import React, { useState, useEffect } from "react";
import { PromptlySettings } from "../lib/types";

interface HistoryPanelProps {
  settings: PromptlySettings;
  onClose: () => void;
  onUseHistoryItem: (text: string) => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  settings,
  onClose,
  onUseHistoryItem
}) => {
  const [historyItems, setHistoryItems] = useState<Array<{ 
    id: string; 
    original: string; 
    optimized: string; 
    timestamp: number 
  }>>([]);

  useEffect(() => {
    // Load history from storage
    chrome.storage.sync.get(["promptly_history_v1"], (result) => {
      const history = result["promptly_history_v1"] as Array<{ 
        id: string; 
        original: string; 
        optimized: string; 
        timestamp: number 
      }> || [];
      setHistoryItems(history);
    });
  }, []);

  const addToHistory = (original: string, optimized: string) => {
    if (!settings.historyEnabled) return;
    
    const newItem = {
      id: Math.random().toString(36).substr(2, 9),
      original,
      optimized,
      timestamp: Date.now()
    };
    
    setHistoryItems(prev => {
      const updated = [newItem, ...prev];
      // Limit to maxHistoryItems
      return updated.slice(0, settings.maxHistoryItems);
    });
    
    // Save to storage
    chrome.storage.sync.set({
      "promptly_history_v1": [...historyItems, newItem].slice(0, settings.maxHistoryItems)
    });
  };

  return (
    <div
      className="promptly-panel"
      style={{
        width: 380,
        maxWidth: "90vw",
        maxHeight: "90vh",
        display: "flex",
        flexDirection: "column",
        borderRadius: 16,
        background: "rgba(15,15,22,0.7)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        border: "1px solid rgba(255,255,255,0.125)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
        color: "#F2F2F8",
        overflow: "hidden"
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 9999,
              background: "linear-gradient(135deg,#4FE6E0,#8B6CFF,#FF5FB8)"
            }}
          />
          <span style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 14, fontWeight: 600, letterSpacing: 0.2 }}>
            Promptly History
          </span>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{ background: "transparent", border: "none", color: "#9594B3", cursor: "pointer", fontSize: 16, lineHeight: 1 }}
        >
          ×
        </button>
      </div>

      {/* History List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
        {historyItems.length === 0 ? (
          <div style={{ textAlign: "center", color: "#9594B3", padding: "40px" }}>
            No history yet. Start optimizing prompts to see them here.
          </div>
        ) : (
          <div>
            {historyItems.map((item) => (
              <div 
                key={item.id} 
                style={{ 
                  borderBottom: "1px solid rgba(255,255,255,0.08)", 
                  padding: "12px 0",
                  cursor: "pointer",
                  transition: "background 0.2s ease"
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                onClick={() => onUseHistoryItem(item.optimized)}
              >
                <div style={{ fontSize: 12.5, color: "#9594B3", marginBottom: 4 }}>
                  Original: {item.original.length > 50 ? item.original.substring(0, 50) + "..." : item.original}
                </div>
                <div style={{ fontSize: 13, fontFamily: "JetBrains Mono, monospace", color: "#F2F2F8" }}>
                  {item.optimized.length > 100 ? item.optimized.substring(0, 100) + "..." : item.optimized}
                </div>
                <div style={{ fontSize: 11, color: "#6B6B80", marginTop: 4 }}>
                  {new Date(item.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ display: "flex", gap: 8, padding: "12px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <button
          onClick={onClose}
          style={{
            flex: 1,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.10)",
            color: "#F2F2F8",
            borderRadius: 10,
            padding: "9px 12px",
            fontSize: 12.5,
            cursor: "pointer"
          }}
        >
          Close
        </button>
        {historyItems.length > 0 && (
          <button
            onClick={() => {
              // Clear history
              setHistoryItems([]);
              chrome.storage.sync.remove(["promptly_history_v1"]);
            }}
            style={{
              flex: 1,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.10)",
              color: "#F2F2F8",
              borderRadius: 10,
              padding: "9px 12px",
              fontSize: 12.5,
              cursor: "pointer"
            }}
          >
            Clear History
          </button>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Integrate HistoryPanel into main index.tsx**

```typescript
// In index.tsx, add history panel state and logic
const [historyOpen, setHistoryOpen] = React.useState(false);

// Add to settings useEffect
React.useEffect(() => {
  getSettings().then(setSettings);
  onSettingsChanged(setSettings);
}, []);

// Add history toggle to UI (could be a button in header)
// Modify the header in OptimizerPanel or add a new button in index.tsx

// Render history panel when open
{historyOpen && (
  <HistoryPanel
    settings={settings || DEFAULT_SETTINGS}
    onClose={() => setHistoryOpen(false)}
    onUseHistoryItem={(text) => {
      // Use the history item - would need to integrate with optimization flow
      setOriginalText(text);
      setHistoryOpen(false);
      // Trigger optimization
      runOptimize();
    }}
  />
)}

// Add open/close functions
const openHistory = () => setHistoryOpen(true);
const closeHistory = () => setHistoryOpen(false);
```

- [ ] **Step 5: Test history panel**

Run: `cd promptly-extension && npm run dev`
Expected: 
- History panel opens/closes correctly
- Optimization results are saved to history
- History items can be selected to reuse
- History persists across browser sessions
- Max history limit is respected

- [ ] **Step 6: Commit history panel feature**

```bash
git add promptly-extension/src/lib/storage.ts promptly-extension/src/content/HistoryPanel.tsx promptly-extension/src/content/index.tsx
git commit -m "feat: add history panel for tracking optimization results"
```

### Task 7: Implement Performance Optimizations

**Files:**
- Modify: `promptly-extension/src/lib/promptEngine.ts`
- Modify: `promptly-extension/src/content/index.tsx`
- Modify: `promptly-extension/src/content/OptimizerPanel.tsx`

- [ ] **Step 1: Add request debouncing to prompt engine**

```typescript
// In promptEngine.ts, add debounce utility
function debounce<T extends (...args: any[]) => Promise<any>>(
  func: T, 
  wait: number
): (...args: Parameters<T>) => Promise<ReturnType<T> | undefined> {
  let timeout: NodeJS.Timeout;
  return function(...args: Parameters<T>) {
    clearTimeout(timeout);
    return new Promise((resolve, reject) => {
      timeout = setTimeout(() => {
        func.apply(this, args).then(resolve).catch(reject);
      }, wait);
    });
  };
}

// Wrap the optimizePrompt function with debouncing
const debouncedOptimizePrompt = debounce(optimizePrompt, 300); // 300ms debounce

// Export both versions
export async function optimizePrompt(
  req: OptimizeRequest,
  config: { apiBaseUrl?: string; apiKey?: string }
): Promise<OptimizeResponse> {
  // ... existing implementation
}

export const optimizedPromptWithDebounce = debouncedOptimizePrompt;
```

- [ ] **Step 2: Use debounced optimization in OptimizerPanel**

```typescript
// In OptimizerPanel.tsx, import debounced function
import { optimizedPromptWithDebounce } from "../lib/promptEngine";

// Update runOptimize to use debounced version
const runOptimize = async () => {
  // ... existing validation
  
  try {
    const res = await optimizedPromptWithDebounce(
      {
        text: originalText,
        mode,
        level,
        context: settings.contextInjectionEnabled ? settings.contextProfile : undefined
      },
      { apiBaseUrl: settings.apiBaseUrl, apiKey: settings.apiKey }
    );
    // ... rest of existing logic
  } catch (e) {
    // ... existing error handling
  }
};
```

- [ ] **Step 3: Add caching layer for optimization results**

```typescript
// In promptEngine.ts, add simple caching
interface CacheItem {
  result: OptimizeResponse;
  timestamp: number;
}

const optimizationCache = new Map<string, CacheItem>();
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

function getCacheKey(req: OptimizeRequest): string {
  return `${req.text}|${req.mode}|${req.level}|${JSON.stringify(req.context || {})}`;
}

export async function optimizePrompt(
  req: OptimizeRequest,
  config: { apiBaseUrl?: string; apiKey?: string }
): Promise<OptimizeResponse> {
  // Check cache first
  const cacheKey = getCacheKey(req);
  const cached = optimizationCache.get(cacheKey);
  
  if (cached && (Date.now() - cached.timestamp < CACHE_DURATION_MS)) {
    return { ...cached.result, source: "cache" };
  }
  
  // ... existing implementation
  
  // Store result in cache before returning
  optimizationCache.set(cacheKey, {
    result: { optimized, source },
    timestamp: Date.now()
  });
  
  // Clean old cache entries periodically (simple cleanup)
  if (optimizationCache.size > 100) {
    for (const [key, item] of optimizationCache.entries()) {
      if (Date.now() - item.timestamp > CACHE_DURATION_MS) {
        optimizationCache.delete(key);
      }
    }
  }
  
  return { optimized, source };
}
```

- [ ] **Step 4: Optimize re-renders in OptimizerPanel**

```typescript
// In OptimizerPanel.tsx, use useCallback for handlers
const handleReplace = React.useCallback((text: string) => {
  // ... existing implementation
}, []); // Add dependencies as needed

const runOptimize = React.useCallback(async () => {
  // ... existing implementation
}, [originalText, mode, level, settings, settings.contextProfile]); // Proper dependencies

// Use React.memo for child components if needed
```

- [ ] **Step 5: Test performance improvements**

Run: `cd promptly-extension && npm run dev`
Expected: 
- Rapid typing doesn't trigger excessive API calls (debouncing works)
- Repeated optimizations return instantly from cache
- UI remains responsive during optimization
- Memory usage stays reasonable

- [ ] **Step 6: Commit performance optimizations**

```bash
git add promptly-extension/src/lib/promptEngine.ts promptly-extension/src/content/OptimizerPanel.tsx
git commit -m "perf: add debouncing and caching for optimization requests"
```

## Phase 4: Integration and Testing

### Task 8: Comprehensive Testing and Bug Fixing

**Files:**
- Test: Various manual test scenarios

- [ ] **Step 1: Test positioning fix across different screen sizes**

```markdown
Test scenarios:
1. Mobile width (320px) - panel should adapt and not overflow
2. Tablet width (768px) - normal behavior
3. Desktop width (1920px) - normal behavior
4. Various zoom levels (50%, 75%, 100%, 125%, 150%)
5. Different screen orientations (landscape/portrait)
```

- [ ] **Step 2: Test all UI/UX enhancements**

```markdown
Features to verify:
1. Glassmorphism effects work correctly
2. Keyboard navigation (ESC, Ctrl+Enter, Tab)
3. Position memory persists across sessions
4. History panel shows correct data
5. Debouncing prevents rapid API calls
6. Caching returns instant results for repeats
7. All existing functionality still works
```

- [ ] **Step 3: Test cross-browser compatibility**

```markdown
Test in:
- Chrome latest
- Firefox latest  
- Edge latest
- Safari latest (if possible)
```

- [ ] **Step 4: Test on all supported platforms**

```markdown
Test optimization works on:
- ChatGPT (chatgpt.com, chat.openai.com)
- Gemini (gemini.google.com)
- Claude (claude.ai)
- Perplexity (www.perplexity.ai, perplexity.ai)
- Grok (grok.com)
- DeepSeek (chat.deepseek.com)
```

- [ ] **Step 5: Document any issues found and fix them**

```bash
# As issues are discovered during testing
git add <modified-files>
git commit -m "fix: description of issue resolved"
```

- [ ] **Step 6: Final integration test**

Run: `cd promptly-extension && npm run build`
Expected: Successful build with no errors

Run: `cd apps/web && npm run build` 
Expected: Successful build with no errors

- [ ] **Step 7: Commit final testing results**

```bash
git add .
git commit -m "test: comprehensive testing completed and all issues resolved"
```

### Task 9: Prepare for Release

**Files:**
- Modify: `promptly-extension/package.json` (if version bump needed)
- Modify: `promptly-extension/README.md` (update documentation)
- Create: `promptly-extension/CHANGELOG.md`

- [ ] **Step 1: Update version in package.json**

```json
{
  "name": "promptly-prompt-optimizer",
  "private": true,
  "version": "0.2.0", // Bump from 0.1.0
  // ... rest unchanged
}
```

- [ ] **Step 2: Update README with new features**

```markdown
# Promptly Prompt Optimizer

## New in v0.2.0

- **Fixed**: Panel positioning no longer goes out of screen
- **Enhanced UI**: Glassmorphism effects, micro-interactions, modern visual design
- **Improved UX**: Keyboard navigation, position memory per site, history panel
- **Performance**: Request debouncing, result caching for faster repeated optimizations
- **Accessibility**: Full keyboard support, ARIA labels, focus management
```

- [ ] **Step 3: Create changelog**

```markdown
# Changelog

## [0.2.0] - 2026-06-13

### Fixed
- Panel positioning overflow issue when near screen edges
- Enhanced boundary detection ensures panel always stays within viewport

### Added
- Glassmorphism visual effects with animated gradients
- Keyboard navigation (ESC to close, Ctrl+Enter to replace, Tab navigation)
- Position memory per hostname - panel remembers last position
- History panel to track and reuse previous optimizations
- Request debouncing to prevent excessive API calls
- Result caching for instant repeated optimizations
- Improved accessibility with ARIA labels and focus management

### Changed
- Updated positioning logic in content script
- Enhanced visual styles in OptimizerPanel
- Extended settings interface for new features
- Optimized performance with debouncing and caching layers

### Technical
- Bumped minimum supported Chrome version if needed
- Updated dependencies where appropriate
- Improved TypeScript type safety
```

- [ ] **Step 4: Commit release preparation**

```bash
git add promptly-extension/package.json promptly-extension/README.md promptly-extension/CHANGELOG.md
git commit -m "release: prepare v0.2.0 release with all enhancements"
```

## Verification Section

To verify the implementation works correctly:

1. **Positioning Fix Verification**
   - Load extension on any supported site
   - Position orb near each screen edge (top, bottom, left, right)
   - Verify panel never overflows viewport
   - Test on different screen sizes and zoom levels

2. **Visual Enhancement Verification**  
   - Observe glassmorphism effect on panel
   - Notice subtle animations on hover and interaction
   - Verify modern, polished appearance

3. **Usability Verification**
   - Press ESC to close panel
   - Press Ctrl+Enter to replace text with optimized version
   - Use Tab to navigate between controls
   - Verify focus stays within panel when open

4. **Feature Verification**
   - Close and reopen browser - panel should remember last position per site
   - Optimize multiple prompts - check history panel shows results
   - Repeat same optimization - should return instantly from cache
   - Rapidly type in chat input - verify debouncing prevents excessive calls

5. **Regression Verification**
   - All existing optimization functionality should work as before
   - API key and settings should persist
   - Platform detection should work for all supported sites
   - Local fallback should still function when API unavailable

**Success Criteria**: All verification steps pass without issues, and the extension provides a noticeably improved user experience while maintaining all existing functionality.
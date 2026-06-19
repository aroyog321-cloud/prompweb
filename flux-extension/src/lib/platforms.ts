export interface PlatformConfig {
  id: string;
  name: string;
  hostnames: string[];
  /** CSS selectors tried in order to find the prompt input */
  inputSelectors: string[];
  /** True if the input is a contenteditable div rather than a <textarea> */
  contentEditable: boolean;
  /** Selector for an element near which the floating button should anchor */
  anchorSelectors: string[];
  /** Accent color used for the per-platform badge */
  accent: string;
}

/**
 * Adding a new AI platform only requires a new entry here -
 * no changes to the injection, optimization, or replace logic.
 */
export const PLATFORMS: PlatformConfig[] = [
  {
    id: "chatgpt",
    name: "ChatGPT",
    hostnames: ["chatgpt.com", "chat.openai.com"],
    inputSelectors: ["#prompt-textarea", "textarea[data-id='root']", "div[contenteditable='true']"],
    contentEditable: true,
    anchorSelectors: ["form", "#prompt-textarea"],
    accent: "#74AA9C"
  },
  {
    id: "gemini",
    name: "Gemini",
    hostnames: ["gemini.google.com"],
    inputSelectors: ["rich-textarea .ql-editor", "div[contenteditable='true']"],
    contentEditable: true,
    anchorSelectors: ["rich-textarea", "div[contenteditable='true']"],
    accent: "#8E75FF"
  },
  {
    id: "claude",
    name: "Claude",
    hostnames: ["claude.ai"],
    inputSelectors: ["div[contenteditable='true'][role='textbox']", "div.ProseMirror"],
    contentEditable: true,
    anchorSelectors: ["div[contenteditable='true'][role='textbox']", "div.ProseMirror"],
    accent: "#D97757"
  },
  {
    id: "perplexity",
    name: "Perplexity",
    hostnames: ["www.perplexity.ai", "perplexity.ai"],
    inputSelectors: ["textarea", "div[contenteditable='true']"],
    contentEditable: false,
    anchorSelectors: ["textarea"],
    accent: "#20808D"
  },
  {
    id: "grok",
    name: "Grok",
    hostnames: ["grok.com"],
    inputSelectors: ["textarea", "div[contenteditable='true']"],
    contentEditable: false,
    anchorSelectors: ["textarea"],
    accent: "#1DA1F2"
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    hostnames: ["chat.deepseek.com"],
    inputSelectors: ["textarea#chat-input", "textarea"],
    contentEditable: false,
    anchorSelectors: ["textarea#chat-input", "textarea"],
    accent: "#4D6BFE"
  }
];

export function detectPlatform(hostname: string): PlatformConfig | null {
  return PLATFORMS.find((p) => p.hostnames.some((h) => hostname === h || hostname.endsWith(`.${h}`))) ?? null;
}

export function findInputElement(platform: PlatformConfig): HTMLElement | null {
  for (const selector of platform.inputSelectors) {
    const el = document.querySelector<HTMLElement>(selector);
    if (el) return el;
  }
  return null;
}

export function findAnchorElement(platform: PlatformConfig): HTMLElement | null {
  for (const selector of platform.anchorSelectors) {
    const el = document.querySelector<HTMLElement>(selector);
    if (el) return el;
  }
  return null;
}

/** Reads the current text out of a textarea or contenteditable element. */
export function readInputText(el: HTMLElement): string {
  if (el instanceof HTMLTextAreaElement) return el.value;
  return el.innerText;
}

/**
 * Writes text back into a textarea or contenteditable element while
 * dispatching the input events the host page listens for, so its
 * own React/Vue state stays in sync.
 */
export function writeInputText(el: HTMLElement, text: string): void {
  el.focus();
  if (el instanceof HTMLTextAreaElement) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
    setter?.call(el, text);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.setSelectionRange(text.length, text.length);
    return;
  }

  // contenteditable: clear then insert via execCommand for max compatibility
  el.focus();
  // Normalize consecutive newlines for contenteditable elements. Modern rich-text editors
  // (like Lexical on ChatGPT or ProseMirror on Claude) treat \n as a block/paragraph break.
  // Double newlines (\n\n) get doubled or expanded into massive blank paragraph gaps.
  const normalizedText = text.replace(/\r\n/g, "\n").replace(/\n\n+/g, "\n");

  document.execCommand("selectAll", false);
  document.execCommand("delete", false);
  document.execCommand("insertText", false, normalizedText);
  el.dispatchEvent(new Event("input", { bubbles: true }));

  // move cursor to end
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

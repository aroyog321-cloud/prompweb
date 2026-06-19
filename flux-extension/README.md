# Promptly Prompt Optimizer — Browser Extension

A Chrome (Manifest V3) extension that injects a floating "Optimize Prompt"
orb next to the chat input on ChatGPT, Gemini, Claude, Perplexity, Grok, and
DeepSeek, rewrites your rough instruction into an expert-level prompt, and
replaces it in place.

## Stack

- Vite + `@crxjs/vite-plugin` for MV3 bundling and HMR during development
- React 19-style functional components, TypeScript
- Tailwind CSS (scoped into a Shadow DOM for the in-page UI)
- Zod/Zustand are wired into `package.json` for the dashboard work to come

## Project layout

```
promptly-extension/
├── manifest.json              # MV3 manifest (content scripts, commands, permissions)
├── index.html                 # Popup entry
├── src/
│   ├── background/index.ts    # Service worker — keyboard shortcut relay
│   ├── content/
│   │   ├── index.tsx           # Content script entry: detects platform, mounts shadow DOM UI
│   │   ├── FloatingButton.tsx  # The orb button
│   │   ├── OptimizerPanel.tsx  # Glassmorphism popover: modes, levels, preview, replace
│   │   └── content.css         # Tailwind source, injected into the shadow root
│   ├── lib/
│   │   ├── platforms.ts        # Config-driven registry of supported AI sites
│   │   ├── promptEngine.ts     # optimizePrompt() — calls Promptly API, falls back to local pipeline
│   │   ├── storage.ts          # chrome.storage.sync wrapper for settings
│   │   └── types.ts            # Shared types: modes, levels, settings, context profile
│   └── popup/
│       ├── Popup.tsx           # Settings UI (defaults, context memory, API key, shortcut)
│       ├── main.tsx
│       └── popup.css
└── public/icons/               # Generated extension icons
```

## Adding a new AI platform

No code changes needed outside `src/lib/platforms.ts`. Add an entry to the
`PLATFORMS` array with the hostnames, the CSS selectors for the chat input
(and whether it's a `<textarea>` or `contenteditable` div), and an accent
color. Also add the hostname to `manifest.json` under `host_permissions` and
`content_scripts.matches`.

```ts
{
  id: "my-new-ai",
  name: "My New AI",
  hostnames: ["mynewai.com"],
  inputSelectors: ["textarea#prompt"],
  contentEditable: false,
  anchorSelectors: ["textarea#prompt"],
  accent: "#FF8800"
}
```

> Selectors for hosted chat UIs change often — if the orb stops appearing on
> a given site, it's almost always because the site updated its DOM and the
> selector in `platforms.ts` needs a refresh.

## Prompt engine

`optimizePrompt()` in `src/lib/promptEngine.ts`:

1. If `apiBaseUrl` + `apiKey` are set (Promptly account connected), it POSTs to
   `${apiBaseUrl}/v1/optimize` with `{ text, mode, level, context }` and the
   system prompt defined in `SYSTEM_PROMPT`. This is where the real
   LLM-backed optimization (Intent Detection → Context Expansion → Goal
   Clarification → Output Structuring → Prompt Generation) should live, on
   the backend.
2. If no account is connected, or the request fails, it runs a **local
   template-based fallback** so the extension is still useful offline / for
   free users before the backend exists.

The backend endpoint (`/v1/optimize`) is the next piece to build — it should
implement the 5-stage pipeline described in the system prompt using an LLM
call, and persist the request to `PromptHistory`.

## Settings & context memory

Stored via `chrome.storage.sync` (`src/lib/storage.ts`) so they sync across a
user's signed-in Chrome profile:

- Default mode / rewrite level
- Context profile (company, industry, audience, brand tone, writing style,
  website) — optionally injected into every optimization
- Promptly API base URL + key (falls back to local pipeline if empty)

## Development

```bash
npm install
npm run dev     # Vite dev server with HMR for the extension
npm run build   # Production build → dist/
```

## Load into Chrome

1. `npm run build`
2. Go to `chrome://extensions`
3. Enable **Developer mode**
4. **Load unpacked** → select the `dist/` folder
5. Visit chatgpt.com, claude.ai, gemini.google.com, perplexity.ai, grok.com,
   or chat.deepseek.com — the Promptly orb should appear beside the chat input.
   Click it, or press `Ctrl+Shift+P`, to optimize.

## Known gaps / next steps

- **Backend `/v1/optimize`**: not implemented yet — extension currently runs
  the local fallback pipeline for everyone. This is the natural next slice
  to build on top of the ContentOS/Next.js backend stack.
- **Selectors**: `platforms.ts` selectors are best-effort and should be
  verified/updated against the live DOM of each platform (these UIs change
  frequently, especially ChatGPT and Gemini).
- **Auth**: popup currently stores a raw API key; once the Next.js dashboard
  + NextAuth flow exists, swap this for an OAuth/device-code flow so users
  never paste a long-lived key.
- **AI comparison / templates / history**: live in the dashboard (Next.js +
  Prisma), not the extension — the extension is the "capture + optimize +
  replace" surface only.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Extension (promptly-extension)
- `npm run dev` - Start Vite dev server for the Chrome extension (serves at http://localhost:5173)
- `npm run build` - Build the extension for production (output to dist/)
- `npm run preview` - Preview the built extension locally

### Web API (apps/web)
- `npm run dev` - Start Next.js dev server (http://localhost:3000)
- `npm run build` - Build for production
- `npm start` - Start Next.js production server

### Shared
- Prisma: `npx prisma generate` to generate Prisma client, `npx prisma migrate dev` for migrations.

## Code Architecture

### Chrome Extension (promptly-extension)
- **Manifest V3**: Configured in `manifest.json` (processed by @crxjs/vite-plugin)
- **Content Script**: `src/content/index.tsx` - React app injected into target websites via shadow DOM
- **Background Service Worker**: `service-worker-loader.js` (generated) - handles extension lifecycle and commands
- **Popup**: `index.html` (public) with React root? The manifest shows `default_popup: "index.html"`; the extension uses a single React app that can serve as both content script and popup? Actually, the content script renders a floating orb and panel; the popup might be unused.
- **Libraries**: 
  - `src/lib/platforms.ts` - Detects AI website platform (ChatGPT, Claude, etc.) and provides helpers to read/write input fields.
  - `src/lib/storage.ts` - Chrome sync storage wrapper for settings.
  - `src/lib/promptEngine.ts` - Calls the backend API (`/api/optimize`) with fallback to local prompt optimization pipeline.
  - `src/lib/types.ts` - Shared TypeScript interfaces (OptimizeRequest, OptimizeResponse, settings, etc.)
- **Styles**: `src/content/content.css` (inlined as React CSS module) and TailwindCSS via `tailwind.config.ts`.

### Next.js API (apps/web)
- **App Router**: Uses Next.js 16+ `app` directory. API routes under `src/app/api/`.
- **Optimize Endpoint**: `src/app/api/optimize/route.ts` - Handles POST requests, integrates with Gemini API (using provided API key) with local fallback.
- **Local Optimization Pipeline**: Implemented in `optimizeWithLLM` function (same as extension's local pipeline for consistency).
- **Gemini Integration**: `optimizeWithGemini` function calls Gemini 1.5 Flash API.
- **Types**: `src/lib/types.ts` (duplicate of extension's types? Ideally should be shared via a monorepo package, but currently duplicated).
- **Middleware**: None observed.
- **Environment Variables**: Not yet used; Gemini API key hardcoded for development (should be moved to env).
- **Prisma**: Schema likely in `prisma/schema.prisma` (not examined). Used for storing prompt history? (TODO in code).

### Shared Logic
- Both extension and API contain a local 5-stage prompt optimization pipeline (Intent Detection → Context Expansion → Goal Clarification → Output Structuring → Prompt Generation). The API uses this as fallback when Gemini fails.
- The extension settings are stored in Chrome sync storage; the API expects settings via request headers (apiBaseUrl, apiKey) from the extension.

## Development Workflow
1. Start both dev servers: 
   - In one terminal: `cd promptly-extension && npm run dev`
   - In another: `cd apps/web && npm run dev`
2. Load the unpacked extension from `promptly-extension/dist` in Chrome (chrome://extensions → Load unpacked).
3. Visit a supported AI site (chatgpt.com, claude.ai, etc.) to see the Promptly orb.
4. Click orb to open optimizer panel; it will call the local API at `http://localhost:3000/api/optimize`.
5. Optimized prompts are returned via Gemini API (if key valid) or local fallback.

## Notes
- The extension's content script uses shadow DOM to avoid CSS conflicts.
- The background service worker listens for the `optimize-prompt` command (Ctrl+Shift+P) to trigger the optimizer.
- API key for Gemini is currently hardcoded in the Next.js route; in production should be stored in environment variables.
- The extension's default API URL is set to `http://localhost:3000` for local development; change for production.
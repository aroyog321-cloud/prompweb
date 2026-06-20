# CLAUDE.md (Web API)

This file provides guidance for working on the Next.js API portion of the Promptly Prompt Optimizer repository.

For general repository guidance (commands, architecture, etc.), see the root [CLAUDE.md](../CLAUDE.md).

## Next.js Specific

### Development
- `npm run dev` - Start Next.js dev server (http://localhost:3000)
- `npm run build` - Build for production
- `npm start` - Start Next.js production server

### API Routes
- Located in `src/app/api/` using the Next.js 16+ App Router.
- The main endpoint is `src/app/api/optimize/route.ts` which handles prompt optimization via Gemini API with local fallback.

### Types
- Type interfaces are currently duplicated in `src/lib/types.ts` (should ideally be shared with the extension via a local package).

### Environment
- Gemini API key is currently hardcoded in `src/app/api/optimize/route.ts` for development; move to environment variables in production.

### Prisma
- Database schema in `prisma/schema.prisma`.
- Run `npx prisma generate` after schema changes.
- Use `npx prisma studio` to browse the database during development.

## Notes
- The API is designed to be called by the Chrome extension (promptly-extension) which provides the API key and base URL via request headers.
- Local optimization pipeline mirrors the one in the extension for consistency when Gemini API fails.
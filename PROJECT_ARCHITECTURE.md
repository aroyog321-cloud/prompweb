# Flux Prompt Optimizer - Project Architecture

## Overview
Flux Prompt Optimizer is a universal AI layer that works as a browser extension and SaaS platform. It optimizes user prompts for various AI platforms (ChatGPT, Gemini, Claude, etc.) and provides a dashboard for managing prompts, templates, and usage analytics.

## Tech Stack
- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS, Framer Motion, shadcn/ui
- **Extension**: Chrome Extension Manifest V3, TypeScript, React, Vite
- **Backend**: Next.js API Routes, PostgreSQL, Prisma ORM
- **Authentication**: NextAuth (Google, GitHub)
- **Payments**: Stripe
- **Hosting**: Vercel
- **Analytics**: PostHog
- **Error Monitoring**: Sentry
- **State Management**: Zustand
- **Validation**: Zod
- **API**: REST API

## Folder Structure
```
flux-prompt-optimizer/
├── apps/
│   ├── extension/          # Chrome Extension (Vite + React + TS)
│   └── web/                # Next.js Web Application (Dashboard + Marketing)
├── packages/
│   ├── shared/             # Shared TypeScript code (types, utils, constants)
│   ├── ui/                 # Shared UI components (shadcn/ui based)
│   └── db/                 # Prisma schema and database client
├── prisma/                 # Prisma schema, migrations, seed
├── scripts/                # Setup, deployment, and utility scripts
├── .github/                # GitHub Actions workflows
├── .env.example            # Environment variables template
├── .eslintrc.js            # ESLint configuration
├── .prettierrc             # Prettier configuration
├── README.md
├── turbo.json              # Turborepo configuration (for monorepo)
└── package.json            # Root package.json (workspaces)
```

## Key Components

### 1. Chrome Extension (`apps/extension`)
- **Manifest V3** (`manifest.json`)
- **Content Scripts**: Detect AI platforms and inject Optimize button
- **Background Service Worker**: Handle extension lifecycle and messaging
- **Popup UI**: Settings and optimization controls (React + Vite)
- **Options Page**: User preferences and API key management
- **Utilities**: Prompt optimization logic, platform detection

### 2. Web Application (`apps/web`)
- **Next.js 15** with App Router
- **Authentication**: Next.js API routes with NextAuth
- **Dashboard**: Prompt history, saved prompts, templates, analytics
- **Marketing Pages**: Landing, features, pricing, docs
- **API Routes**: Backend endpoints for data operations
- **Components**: Reusable UI elements from `@flux/ui`
- **Styles**: Tailwind CSS with custom theme

### 3. Shared Packages (`packages/`)
#### `shared`
- TypeScript interfaces and types
- Constants (API endpoints, platform configs)
- Utility functions (date formatting, string manipulation)
- Zod schemas for validation

#### `ui`
- Shared React components (buttons, inputs, modals, etc.)
- Built with shadcn/ui primitives and Tailwind
- Theme-aware (light/dark mode)
- Exportable as `@flux/ui`

#### `db`
- Prisma schema definition
- Prisma client instance
- Database utility functions
- Migration scripts

### 4. Database (`prisma/`)
- Schema definition (`schema.prisma`)
- Migrations directory
- Seed data for development
- Studio configuration

## Architecture Layers

### Presentation Layer
- Extension UI (React/Vite)
- Web Dashboard (Next.js/React)
- Marketing Site (Next.js)

### Application Layer
- Prompt Optimization Engine (core logic)
- Platform Detection Service
- Context Memory Manager
- Template Engine
- AI Comparison Service

### Data Layer
- PostgreSQL database
- Prisma ORM for data access
- Caching layer (Redis - for production scaling)
- File storage (AWS S3 or similar for assets)

### Integration Layer
- AI Platform APIs (ChatGPT, Gemini, etc. - via their official APIs)
- Stripe API for payments
- PostHog for analytics
- Sentry for error monitoring
- NextAuth for authentication

## Data Flow

### Prompt Optimization Flow
1. User types in AI chat input
2. Extension detects platform and shows Optimize button
3. User clicks button → sends text to optimization engine
4. Engine processes through pipeline:
   - Intent Detection
   - Context Expansion (uses user's context memory)
   - Goal Clarification
   - Output Structuring
   - Prompt Generation (using system prompt)
5. Optimized prompt replaces original text in chat input
6. User sends to AI platform

### SaaS Platform Flow
1. User signs up via Google/GitHub
2. Accesses dashboard to view history, save prompts
3. Manages context profiles (company, audience, etc.)
4. Browse/template marketplace
5. Subscription management via Stripe
6. Usage analytics tracked via PostHog

## Scalability Considerations
- **Extension**: Lazy-loaded optimization engine, minimal DOM impact
- **Web App**: Next.js incremental static regeneration, edge caching
- **Database**: Proper indexing, connection pooling, read replicas
- **API**: Rate caching, request deduplication, CDN for static assets
- **Extensions**: Configurable platform detection for easy expansion
- **Backend**: Stateless API routes, horizontal scaling ready

## Security Measures
- JWT-based authentication with refresh token rotation
- CSRF protection on all mutating endpoints
- Rate limiting per IP and user
- Input sanitization and validation (Zod)
- Secure headers (helmet.js equivalent)
- Encryption for sensitive data at rest
- Regular dependency audits

## Performance Optimizations
- Code splitting and dynamic imports
- Image optimization (Next.js Image)
- CSS purging (Tailwind JIT)
- Service worker caching for extension assets
- Database query optimization
- CDN for static assets
- Web Vitals monitoring

## Development Workflow
1. Feature branches per Jira ticket
2. Pull requests with required reviews
3. Automated testing (unit, integration, e2e)
4. Staging deployment on PR
5. Production deployment via Vercel/GitHub Actions
6. Feature flags for gradual rollouts

## Monitoring & Observability
- Sentry for error tracking
- PostHog for user analytics and funnels
- Custom metrics for optimization latency
- Health check endpoints
- Log aggregation (ELK or similar)
- Uptime monitoring

## Deployment Guide
### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Vercel account
- Stripe account
- PostHog account
- Sentry account

### Local Development
1. Copy `.env.example` to `.env.local` in root and `apps/web`
2. Install dependencies: `npm install`
3. Generate Prisma client: `npx prisma generate`
4. Run migrations: `npx prisma migrate dev`
5. Start development: `npm run dev` (starts all apps via Turborepo)

### Production Deployment
1. Push to main branch triggers Vercel deployment
2. Vercel automatically builds and deploys:
   - `apps/web` to Vercel platform
   - Extension built as static asset served via Vercel
3. Database migrations run automatically on deployment
4. Environment variables configured in Vercel dashboard

## Testing Strategy
- **Unit Tests**: Jest + React Testing Library for components
- **Integration Tests**: Supertest for API routes
- **E2E Tests**: Playwright for critical user flows
- **Extension Tests**: WebdriverIO for Chrome extension behavior
- **Visual Regression**: Storybook + Chromatic
- **Coverage Target**: 80%+ for critical paths

## CI/CD Pipeline
```yaml
# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - Uses: actions/checkout@v3
      - Uses: actions/setup-node@v3
        with: {node-version: '18'}
      - Run: npm ci
      - Run: npm run lint
      - Run: npm test
      - Run: npx prisma generate
      - Run: npx prisma migrate deploy --skip-seed

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - Uses: actions/checkout@v3
      - Uses: actions/setup-node@v3
        with: {node-version: '18'}
      - Run: npm ci
      - Run: npm run build

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    uses: ./.github/workflows/vercel-deploy.yml
```
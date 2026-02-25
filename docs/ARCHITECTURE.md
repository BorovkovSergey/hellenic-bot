# Hellenic Bot — Architecture

Telegram bot with a Mini App for learning Greek through mini tasks and flashcards, with a custom set of words and rules.

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Monorepo | pnpm workspaces + Turborepo | Package management, build caching |
| Bot | grammY | Telegram bot |
| API | Hono + Hono RPC | HTTP server for Mini App, end-to-end type safety |
| Frontend | React + Vite | Telegram Mini App |
| DB | Drizzle ORM + PostgreSQL | Data storage, type-safe queries |
| Validation | Zod | Shared validation schemas (frontend + backend) |
| Shared | TypeScript package | Types, Zod schemas, constants, SRS logic |

## Project Structure

```
hellenic-bot/
├── packages/
│   ├── shared/       # Shared types, Zod schemas, constants, SRS logic
│   ├── bot/          # Telegram bot (grammY)
│   ├── api/          # HTTP server (Hono) + Drizzle schema & migrations
│   └── webapp/       # Mini App (React + Vite)
├── docs/
├── docker-compose.yml
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json
```

### Packages

| Package                  | Description                                                        | Depends on     |
|--------------------------|--------------------------------------------------------------------|----------------|
| `@hellenic-bot/shared`   | TypeScript types, Zod validation schemas, SRS logic                | —              |
| `@hellenic-bot/api`      | Hono HTTP server, Drizzle ORM schema & migrations, API routes      | `shared`       |
| `@hellenic-bot/bot`      | grammY Telegram bot, `/start` handler, user upsert via API         | `shared`, `api` (types only; runtime HTTP calls) |
| `@hellenic-bot/webapp`   | React + Vite Mini App, consumes API via Hono RPC typed client      | `shared`, `api` (types only) |

### Package Details

**shared** — The dependency root. Contains:
- Zod schemas for API request/response validation (used by both `api` and `webapp`)
- TypeScript types inferred from Zod schemas
- SRS logic: stage intervals, exercise-per-stage rules, stage progression function (pure logic — given errors and current stage, returns new stage and interval)
- Exercise type definitions

**api** — HTTP server and database owner. Contains:
- Hono route definitions (exports `AppType` for Hono RPC)
- Drizzle ORM schema (tables, enums, relations)
- Drizzle migrations (`pnpm --filter api db:generate / db:migrate`)
- Business logic: word selection, exercise generation, progress updates (applies SRS logic from `shared`)

**bot** — Telegram entry point. Contains:
- grammY bot setup (long polling)
- `/start` command handler (user upsert via API + welcome message)
- Unrecognized input handler
- Hono RPC typed client (imports `AppType` from `api` — compile-time types only, at runtime communicates with `api` via HTTP)

**webapp** — Telegram Mini App. Contains:
- React SPA (Vite)
- Hono RPC typed client (imports `AppType` from `api` — types only, no runtime dependency)
- Screens: Home, Settings, Lesson, Lesson Complete
- Telegram Mini App SDK integration (theme, back button, haptics)

## Key Decisions

### Full TypeScript monorepo

Single language across frontend and backend. The `shared` package contains types, Zod schemas, and SRS logic — defined once, reused everywhere.

### Hono over NestJS / Express

- End-to-end type safety via Hono RPC — frontend gets a typed API client with no codegen
- Minimal overhead (~14 KB)
- For ~5-10 Mini App endpoints, an enterprise framework with DI, modules, and decorators is unnecessary

### PostgreSQL

- Handles production load
- Drizzle ORM supports pg-specific types (jsonb, arrays)
- Native full-text search for Greek words without Elasticsearch
- Easy to deploy via Docker or managed services (Supabase, Neon)

### Drizzle ORM

Type-safe queries, DB schema = TypeScript types. Migrations out of the box.

### Zod

Single source of truth for validation — schema defined in `shared`, used on both API (middleware) and frontend (forms). Types inferred automatically via `z.infer`.

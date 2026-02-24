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
| Shared | TypeScript package | Types, Zod schemas, constants, business logic |

## Project Structure

```
hellenic-bot/
├── packages/
│   ├── shared/       # Shared types, Zod schemas, constants
│   ├── bot/          # Telegram bot (grammY)
│   ├── api/          # HTTP server (Hono)
│   └── webapp/       # Mini App (React + Vite)
├── docs/
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json
```

## Key Decisions

### Full TypeScript monorepo

Single language across frontend and backend. The `shared` package contains types, Zod schemas, and business logic — defined once, reused everywhere.

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

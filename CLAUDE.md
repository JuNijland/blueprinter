# Blueprinter

Blueprinter is an event-driven data broker that monitors web pages for changes to structured entities and emits events when they occur.

**Read `docs/SPEC.md` for full product context and `docs/SCHEMA.md` for database design before making changes.**

## Tech Stack

- **Web app**: Next.js 15 (App Router), TypeScript (strict), shadcn/ui, Drizzle ORM
- **Worker**: Go 1.22+, sqlc for database queries, ConnectRPC for gRPC
- **Database**: PostgreSQL 16
- **Auth**: WorkOS (AuthKit) — do not build custom auth
- **HTML fetching**: Firecrawl (via worker only)
- **Blueprint generation**: OpenAI (via worker only)
- **Reverse proxy**: Caddy 2
- **Task runner**: Taskfile (not Makefile)

## Repository Structure

```
/
├── CLAUDE.md
├── Taskfile.yml
├── docker-compose.yml
├── docs/
│   ├── SPEC.md              # Product specification
│   ├── SCHEMA.md            # Database schema design
│   └── ARCHITECTURE.md      # Architecture decisions
├── migrations/              # Shared SQL migrations (plain .sql files, numbered)
├── proto/                   # Protobuf definitions (ConnectRPC)
│   └── blueprinter/v1/
├── web/                     # Next.js application
│   ├── src/
│   │   ├── app/             # App Router pages and layouts
│   │   ├── components/      # React components (shadcn + custom)
│   │   ├── db/
│   │   │   └── schema/      # Drizzle schema definitions
│   │   ├── lib/             # Shared utilities
│   │   └── server/          # Server actions and API routes
│   ├── drizzle.config.ts
│   ├── package.json
│   └── tsconfig.json
└── worker/                  # Go service
    ├── cmd/
    │   └── worker/          # Main entrypoint
    ├── internal/
    │   ├── db/              # sqlc generated code + queries
    │   ├── blueprint/       # Blueprint generation logic
    │   ├── crawler/         # Firecrawl integration
    │   ├── scheduler/       # Watch cron scheduler
    │   ├── differ/          # Entity diff engine
    │   ├── delivery/        # Event delivery (webhook, email, Slack)
    │   └── grpc/            # ConnectRPC handlers
    ├── go.mod
    └── go.sum
```

## Conventions

### General

- Use `task <command>` for all operations, never raw npm/go commands directly
- Every table has `org_id` (text, from WorkOS) for multitenancy — no exceptions
- All timestamps are `timestamptz` stored in UTC
- UUIDs for all primary keys, generated as UUIDv7 (time-sortable)
- Environment variables: use `.env` files locally, never commit secrets

### TypeScript / Next.js

- Strict mode always (`"strict": true` in tsconfig)
- Use server actions for mutations, not API routes (unless external-facing)
- shadcn/ui for all components — do not install other UI libraries
- Layout: based on shadcn sidebar-7 example
- Drizzle for all database access — no raw SQL in the web app
- Use `org_id` from WorkOS session to scope all queries
- File naming: kebab-case for files, PascalCase for components
- Imports: use `@/` path alias for `src/`

### Go / Worker

- sqlc for all database queries — no raw SQL strings, no ORM
- ConnectRPC (not raw gRPC) for web ↔ worker communication
- Package structure: `internal/` for all packages, nothing in `pkg/`
- Error handling: always wrap errors with `fmt.Errorf("context: %w", err)`
- Logging: use `slog` (structured logging), no `fmt.Println` or `log`
- Context: pass `context.Context` as first parameter everywhere
- Configuration: environment variables via `env` struct, parsed at startup

### Database / Migrations

- Migration files live in `/migrations/` as plain SQL: `001_create_sources.sql`, `002_create_blueprints.sql`, etc.
- Each migration file has `-- +goose Up` and `-- +goose Down` sections (goose format)
- Drizzle schema in `web/src/db/schema/` must mirror the migration state
- sqlc queries in `worker/internal/db/queries/` must match the same schema
- Both Drizzle and sqlc read from the same Postgres instance — keep them in sync manually
- Foreign keys: always define them, always index them
- Soft deletes: use `deleted_at timestamptz` where needed, not hard deletes

### Proto / gRPC

- Proto files in `proto/blueprinter/v1/`
- Service name: `BlueprintService`
- Use ConnectRPC for code generation (both Go server and TypeScript client)
- RPCs defined so far: `FetchHTML`, `GenerateBlueprint`, `TestBlueprint`

### Testing

- Go: table-driven tests, use `testify` for assertions
- TypeScript: Vitest for unit tests, Playwright for E2E (post-MVP)
- Test files live next to source files (`foo.test.ts`, `foo_test.go`)

### What NOT To Do

- Do not create separate CSS/SCSS files — shadcn + Tailwind handles all styling
- Do not add Express or any other HTTP framework to the web app
- Do not use `node-postgres` directly — always go through Drizzle
- Do not sync WorkOS user/org data into our database — query WorkOS at runtime
- Do not put business logic in API routes — use server actions or dedicated service modules
- Do not add gRPC calls outside of the worker communication — REST/server actions for everything else
- Do not use `any` in TypeScript — fix the types

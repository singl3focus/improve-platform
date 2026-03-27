# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Improve Platform** is a personal learning management platform (single-user MVP). Users manage learning roadmaps (DAG of topics), track tasks on a kanban board, organize materials, and monitor progress on a dashboard.

Monorepo with two independent services:
- `frontend/` — Next.js 14 + TypeScript, Tailwind CSS
- `backend/` — Go 1.25 + chi router + PostgreSQL (pgx pool)

## Commands

### Frontend (`cd frontend`)
```bash
npm run dev           # Start dev server (localhost:3000)
npm run build         # Production build
npm run start         # Production server (after build)
npm run lint          # ESLint (next lint)
npx tsc --noEmit      # Typecheck only (no npm script)
npm test              # Compile .test.ts via tsconfig.test.json → .test-dist/, then node --test
npm run verify:mvp    # Node smoke script (scripts/mvp-verification-smoke.mjs)
npm run test:e2e      # Playwright — all specs under e2e/ (needs app + backend up; optional FRONTEND_BASE_URL)
```
First-time Playwright: install browsers with `npx playwright install` (from `frontend/`).

### Backend (`cd backend`)
```bash
go run ./cmd/server              # Start server (requires env vars)
go test ./...                    # Run all tests
go test -v ./internal/roadmap    # Run specific package tests
go build -o bin/server ./cmd/server   # Example binary build
golangci-lint run ./...          # Lint all packages (requires golangci-lint; config: .golangci.yml)
go mod tidy                      # Check dependecies and update it 
```

### Full Stack (Docker Compose — recommended)
```bash
cp build/.env.example .env   # Set JWT_SECRET at minimum
docker compose -f build/docker-compose.yml up -d --build
# Frontend: http://localhost:3000  Backend: http://localhost:8080  Readiness: GET /readyz
```
The compose stack applies SQL migrations from `backend/migrations/` via `migrate/migrate` and **resets the public schema on startup** (destructive) so local DB stays aligned with the initial migration — see comments in `build/docker-compose.yml`.

### Required Backend Env Vars
```
DATABASE_URL=postgres://improve:improve@localhost:5432/improve?sslmode=disable
JWT_SECRET=<random secret>
APP_PORT=8080
```
Optional (see `build/.env.example` and `internal/config`): `LOG_LEVEL` (default `info`), and Telegram notifications — `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `NOTIFY_HOUR`, `NOTIFY_MINUTE`, `NOTIFY_TIMEZONE` (scheduler disabled when token is empty).

## Architecture

### Frontend

**Routing:** Next.js App Router. `/` redirects to `/login` or `/dashboard` based on cookies. Public routes: `/login`, `/register`. Protected routes (see `src/features/auth/lib/session.ts`): `/dashboard`, `/roadmap`, `/topics`, `/tasks`, `/materials`, `/settings` and any subpath (e.g. history at `/dashboard/history`). `middleware.ts` redirects unauthenticated users to `/login` and calls `/api/auth/session` when cookies are present to validate or clear stale sessions.

**Imports:** Path aliases `@/`, `@features/*`, `@shared/*` (see `tsconfig.json`).

**Auth flow:** Access + refresh token cookies. `app/api/*` route handlers proxy to the Go API (`/api/v1/...`). Session checked via `/api/auth/session`.

**View Model pattern:** Each major view uses a hook (`use-*-view-model.ts`) for TanStack Query and local state; route-level components mostly compose feature views.

**Code layout:** `src/features/<domain>/` — UI, hooks, domain helpers; `src/shared/` — API client, providers (`UserPreferencesProvider`, `AppQueryProvider`), shared UI (`GlobalUiControls`, shell). Pure TS logic and unit tests live next to features (e.g. `src/features/roadmap/lib/*.test.ts`). Tests compile via `tsconfig.test.json` into `.test-dist/` and run with Node's native test runner.

**State:** TanStack Query for server state. `UserPreferencesProvider` for UI preferences. `GlobalUiControls` renders global alerts/modals as a portal.

### Backend

**Layered architecture:** `Handler → UseCase → Repository → DB` per domain.

**Layout:** `cmd/server` — entrypoint (config load, pgx pool, optional notify scheduler, HTTP server). `internal/config` — viper, environment variables only. `internal/server` — chi router and handler wiring. Domain packages under `internal/` (`auth`, `roadmap`, `task`, `material`, `history`, `notify`).

Each domain typically has:
- `model.go` — domain types + Repository/Service interfaces
- `handler.go` — HTTP handlers (chi)
- `usecase.go` — business logic
- `repo.go` — PostgreSQL queries (pgx/v5)
- `_test.go` — unit tests per layer

**History logging:** UseCase layer supports an optional `WithRecorder()` pattern that wraps operations to emit `history_events` rows automatically.

**HTTP API:** Versioned REST under `/api/v1/`. Public: `/healthz`, `/readyz`, `/api/v1/auth/register|login|refresh|logout`. All other `/api/v1/*` routes use JWT middleware (`internal/auth/middleware.go`).

**Observability:** Structured JSON logs via `log/slog` (level from `LOG_LEVEL`).

**Notifications:** If `TELEGRAM_BOT_TOKEN` is set, `cmd/server` starts a daily scheduler (`internal/notify`) using `NOTIFY_HOUR`, `NOTIFY_MINUTE`, `NOTIFY_TIMEZONE`.

**Database patterns:**
- Composite keys `(topic_id, user_id)` enforce cross-user isolation
- Topic status: `not_started | in_progress | paused | completed`
- Task status: `new | in_progress | paused | done`
- Material types: `book | article | course | video` (each has unit constraints: pages/lessons/hours)
- Single roadmap per user (DB unique constraint)
- Roadmap is a DAG — `topic_dependencies` table, cycle detection enforced in use case

**Schema:** SQL migrations in `backend/migrations/` (applied automatically in Docker Compose; locally use the same migrate image or an equivalent `migrate` CLI against `DATABASE_URL`).

**Router:** chi.Mux with standard middleware (RequestID, RealIP, Recoverer). JWT middleware protects all routes except `/healthz`, `/readyz`, and the auth endpoints above.
it 
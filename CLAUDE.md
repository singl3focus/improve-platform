# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Improve Platform** is a personal learning management platform (single-user MVP). Users manage learning roadmaps (DAG of topics), track tasks on a kanban board, organize materials, and monitor progress on a dashboard.

Monorepo with two independent services:
- `frontend/` — Next.js 14 + TypeScript
- `backend/` — Go + chi router + PostgreSQL

## Commands

### Frontend (`cd frontend`)
```bash
npm run dev        # Start dev server (localhost:3000)
npm run build      # Production build
npm run lint       # ESLint
npm test           # Compile .test.ts files then run with Node's native test runner
```

### Backend (`cd backend`)
```bash
go run ./cmd/server   # Start server (requires env vars)
go test ./...         # Run all tests
go test -v ./internal/roadmap   # Run specific package tests
```

### Full Stack (Docker Compose — recommended)
```bash
cp build/.env.example .env   # Set JWT_SECRET at minimum
docker compose -f build/docker-compose.yml up -d --build
# Frontend: http://localhost:3000  Backend: http://localhost:8080
```

### Required Backend Env Vars
```
DATABASE_URL=postgres://improve:improve@localhost:5432/improve?sslmode=disable
JWT_SECRET=<random secret>
APP_PORT=8080
```

## Architecture

### Frontend

**Routing:** Next.js App Router. Public routes (`/login`, `/register`) vs. protected routes under `(private)/` group (dashboard, roadmap, tasks, materials, topics, history, settings). `middleware.ts` validates session cookies and redirects unauthenticated users.

**Auth flow:** Access + refresh token cookies. Frontend API routes under `app/api/` proxy to the Go backend. Session checked via `/api/auth/session`.

**View Model pattern:** Each major view has a custom hook (`use-*-view-model.ts`) that owns all data fetching (TanStack Query) and local state. Components are purely presentational.

**Lib modules** (`src/lib/`): Pure TypeScript business logic — roadmap graph algorithms, layout positioning, topic status transitions, API mapping. These are the only files covered by unit tests (`.test.ts` alongside each file). Tests compile via `tsconfig.test.json` into `.test-dist/` and run with Node's native test runner.

**State:** TanStack Query for server state. `UserPreferencesProvider` for UI preferences. `GlobalUiControls` renders global alerts/modals as a portal.

### Backend

**Layered architecture:** `Handler → UseCase → Repository → DB` per domain.

Each domain (`auth`, `roadmap`, `task`, `material`, `history`, `notify`) has:
- `model.go` — domain types + Repository/Service interfaces
- `handler.go` — HTTP handlers (chi)
- `usecase.go` — business logic
- `repo.go` — PostgreSQL queries (pgx/v5)
- `_test.go` — unit tests per layer

**History logging:** UseCase layer supports an optional `WithRecorder()` pattern that wraps operations to emit `history_events` rows automatically.

**Database patterns:**
- Composite keys `(topic_id, user_id)` enforce cross-user isolation
- Topic status: `not_started | in_progress | paused | completed`
- Task status: `new | in_progress | paused | done`
- Material types: `book | article | course | video` (each has unit constraints: pages/lessons/hours)
- Single roadmap per user (DB unique constraint)
- Roadmap is a DAG — `topic_dependencies` table, cycle detection enforced in use case

**Router:** chi.Mux with standard middleware (RequestID, RealIP, Recoverer). JWT middleware protects all routes except `/healthz`, `/readyz`, and auth endpoints.

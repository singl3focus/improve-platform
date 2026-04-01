# Repository Guidelines

## Project Structure & Module Organization
Monorepo with two services:
- `frontend/`: Next.js 14 + TypeScript. Routes in `app/`, domain modules in `src/features/*`, shared code in `src/shared/*`, e2e in `e2e/`.
- `backend/`: Go 1.25 API. Entrypoint `cmd/server`, domains in `internal/*`, shared helpers in `pkg/*`.
- `backend/migrations/`: SQL schema migrations.
- `build/`: Dockerfiles, Compose stack, env templates.

## Build, Test, and Development Commands
- Full stack (recommended):
  `cp build/.env.example .env`  
  `docker compose -f build/docker-compose.yml up -d --build`
- Frontend (`cd frontend`):
  - `npm run dev`, `npm run build`, `npm run start`
  - `npm run lint`, `npx tsc --noEmit`
  - `npm test`
  - `npm run test:e2e` (Playwright), install browsers: `npx playwright install`
- Backend (`cd backend`):
  - `go run ./cmd/server`, `go build -o bin/server ./cmd/server`
  - `go test ./...`, package example: `go test -v ./internal/roadmap`
  - `golangci-lint run ./...`, `go mod tidy`

## Coding Style & Naming Conventions
- Keep Go `gofmt`-clean; `golangci-lint` also enforces `gci` import ordering.
- Frontend linting uses `next/core-web-vitals` + `@typescript-eslint`.
- Use aliases `@/`, `@features/*`, `@shared/*` (see `frontend/tsconfig.json`).
- Naming: Go tests `*_test.go`, TS tests `*.test.ts`, e2e `*.spec.ts`, hooks `use-*-view-model.ts`, Next handlers `app/api/**/route.ts`.
- Backend domains should stay split as `model.go`, `handler.go`, `usecase.go`, `repo.go`.

## Testing Guidelines
- Add tests next to the code you change.
- Backend changes should include use-case and/or handler tests.
- Frontend logic should include `*.test.ts`; user flows go to `e2e/*.spec.ts`.
- E2E base URL defaults to `http://127.0.0.1:3000` (`FRONTEND_BASE_URL` to override).

## Architecture & API Conventions
- Public frontend routes: `/login`, `/register`; private: `/dashboard`, `/roadmap`, `/topics`, `/tasks`, `/materials`, `/settings`.
- `middleware.ts` protects private routes and checks session cookies.
- `app/api/*` in frontend is a BFF proxy to backend `/api/v1/*`.
- Backend layering: `Handler -> UseCase -> Repository -> DB`.
- Public backend endpoints: `/healthz`, `/readyz`, `/api/v1/auth/*`; other `/api/v1/*` require JWT.
- Do not break enum contracts: topic `not_started|in_progress|paused|completed`, task `new|in_progress|paused|done`, material `book|article|course|video`.

## Code Review Graph Workflow
- Use `code-review-graph` first for code review, bugfixes, multi-file changes, and work in unfamiliar areas.
- In this monorepo, prefer running the agent from `frontend/` for frontend tasks and from `backend/` for backend tasks so the graph stays narrow and relevant.
- Before reading files, follow this order: build or update graph -> detect changes -> get impact radius -> get review context -> open only the relevant files.
- If the agent is writing code, repeat graph analysis after the edits on the final diff to catch missed dependencies, risky side effects, and files that still need review or tests.
- Skip graph-first only for tiny single-file edits where the impacted area is already obvious.
- Prompt template for coding tasks: `Сначала используй code-review-graph. Обнови граф для текущего репозитория, определи минимальную затронутую область, прочитай только релевантные файлы, внеси изменения, затем ещё раз проанализируй итоговый diff через graph.`
- Prompt template for review tasks: `Сначала используй code-review-graph. Обнови граф, определи изменённые файлы, посчитай impact radius, собери review context и выполни ревью только по затронутой области кода.`

## Commit & Pull Request Guidelines
- Use short commit prefixes like `feat:`, `chore:`, `major:`.
- Keep commits atomic and imperative.
- PRs should include change summary, linked task/issue, test evidence, and screenshots for UI changes.

## Security & Configuration Tips
- Do not commit real secrets; use `build/.env.example` / `backend/.env.example` as templates.
- Required backend envs: `DATABASE_URL`, `JWT_SECRET`, `APP_PORT`.
- Optional: `LOG_LEVEL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `NOTIFY_HOUR`, `NOTIFY_MINUTE`, `NOTIFY_TIMEZONE`.
- The Docker compose flow resets the `public` schema on startup; do not use it against non-local data.

# Implementation Plan — New Features

## Overview

Three features to implement, in order:
1. **Today View** — daily action plan page with micro-reflections
2. **Activity Heatmap** — GitHub-style contribution calendar on dashboard
3. **Topic Notes** — optional markdown notes inside topics

Each feature follows the project's layered architecture:
- **Backend:** Migration → Model → Repo → UseCase → Handler → Router wiring
- **Frontend:** Types → API route → Hook (view-model) → View component → Page route

Reference patterns: look at existing domains (`dashboard`, `task`, `material`) for naming, error handling, and structure conventions.

---

## Feature 1: Today View

**Goal:** A `/today` page showing 1-3 focus tasks for the day, current material progress, and a quick end-of-day micro-reflection ("What did I learn today?"). The page replaces the need to think about what to do — it tells the user.

### Step 1.1 — Database migration

Create `backend/migrations/000005_today_and_notes.up.sql` and corresponding `.down.sql`.

Tables to add:

```sql
-- Daily plans: one row per user per day
CREATE TABLE daily_plans (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date        DATE NOT NULL DEFAULT CURRENT_DATE,
    reflection  TEXT,          -- micro-reflection text (nullable, filled later in the day)
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, date)
);
CREATE INDEX idx_daily_plans_user_date ON daily_plans(user_id, date);

-- Tasks pinned to a daily plan (ordered)
CREATE TABLE daily_plan_items (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    daily_plan_id  UUID NOT NULL REFERENCES daily_plans(id) ON DELETE CASCADE,
    task_id        UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    position       INT NOT NULL DEFAULT 0,
    is_completed   BOOLEAN NOT NULL DEFAULT false,
    UNIQUE(daily_plan_id, task_id)
);
CREATE INDEX idx_daily_plan_items_plan ON daily_plan_items(daily_plan_id);
```

Down migration: `DROP TABLE IF EXISTS daily_plan_items; DROP TABLE IF EXISTS daily_plans;`

### Step 1.2 — Backend domain: `internal/today`

Create a new domain package `backend/internal/today/` with standard 4 files.

**model.go** — define:
```
DailyPlan        { ID, UserID, Date, Reflection, CreatedAt, UpdatedAt }
DailyPlanItem    { ID, DailyPlanID, TaskID, Position, IsCompleted }
TodayTask        { ID, Title, TopicTitle, Deadline, Status, IsCompleted (in plan), Position }
TodayMaterial    { ID, Title, TopicTitle, Type, CompletedAmount, TotalAmount, ProgressPercent }
TodayResponse    { Date, Tasks []TodayTask, CurrentMaterial *TodayMaterial, Reflection *string }
```

Request types:
```
SetTodayTasksRequest    { TaskIDs []uuid.UUID }
ToggleTaskRequest       { TaskID uuid.UUID, IsCompleted bool }
SaveReflectionRequest   { Reflection string }
```

Interfaces:
```
Repository {
    GetOrCreatePlan(ctx, userID, date) → DailyPlan
    SetPlanItems(ctx, planID, taskIDs []uuid.UUID)
    TogglePlanItem(ctx, planID, taskID, isCompleted)
    SaveReflection(ctx, planID, reflection)
    GetPlanWithItems(ctx, userID, date) → DailyPlan + []DailyPlanItem
    GetTodayTasks(ctx, userID, date) → []TodayTask
    GetCurrentMaterial(ctx, userID) → *TodayMaterial
}
```

Error sentinels: `ErrPlanNotFound`, `ErrTaskNotInPlan`.

**repo.go** — implement Repository against pgx pool:
- `GetOrCreatePlan`: INSERT ... ON CONFLICT (user_id, date) DO NOTHING, then SELECT
- `SetPlanItems`: DELETE existing items for plan, INSERT new ones with positions
- `TogglePlanItem`: UPDATE daily_plan_items SET is_completed WHERE daily_plan_id AND task_id
- `SaveReflection`: UPDATE daily_plans SET reflection, updated_at WHERE id
- `GetTodayTasks`: JOIN daily_plan_items + tasks + topics, ORDER BY position
- `GetCurrentMaterial`: Find the material with the most recent history event for this user where completed_amount < total_amount (or fallback: first in-progress topic's first material). Use a single query joining materials + topics, filtering `completed_amount < total_amount`, ordering by most recently updated, LIMIT 1

**usecase.go** — orchestrate:
- `GetToday(ctx, userID)`:
  1. GetOrCreatePlan for today's date
  2. If plan has no items → auto-populate from dashboard focus logic (reuse `dashboard.Repo.GetFocusTasks` or duplicate the priority query, pick top 3)
  3. GetTodayTasks + GetCurrentMaterial + plan.Reflection
  4. Return TodayResponse
- `SetTasks(ctx, userID, req)`: GetOrCreatePlan → SetPlanItems
- `ToggleTask(ctx, userID, req)`: GetOrCreatePlan → TogglePlanItem. If task is_completed=true → also update task status to "done" in tasks table (call task repo or run direct UPDATE). Record history event.
- `SaveReflection(ctx, userID, req)`: GetOrCreatePlan → SaveReflection. Record history event (business, "daily_reflection.saved").

**handler.go** — HTTP handlers:
- `GET  /api/v1/today`           → GetToday
- `PUT  /api/v1/today/tasks`     → SetTasks (replace task list)
- `PATCH /api/v1/today/tasks/{taskID}/toggle` → ToggleTask
- `PATCH /api/v1/today/reflection` → SaveReflection

All handlers extract userID from JWT context (same pattern as other handlers).

### Step 1.3 — Wire into router

In `backend/internal/server/server.go`:
- Import `internal/today`
- Initialize `today.NewRepo(pool)`, `today.NewUseCase(repo, historyRecorder)`, `today.NewHandler(uc)`
- Register routes under `r.Route("/api/v1/today", func(r chi.Router) { ... })` inside the JWT-protected group

### Step 1.4 — Frontend API routes

Create proxy routes under `frontend/app/api/today/`:

- `app/api/today/route.ts` — GET handler → proxy to `GET /api/v1/today`
- `app/api/today/tasks/route.ts` — PUT handler → proxy to `PUT /api/v1/today/tasks`
- `app/api/today/tasks/[taskId]/toggle/route.ts` — PATCH handler → proxy
- `app/api/today/reflection/route.ts` — PATCH handler → proxy

Follow the same `createBackendClient` + proxy pattern used in existing API routes.

### Step 1.5 — Frontend types

Create `frontend/src/features/today/types.ts`:
```ts
interface TodayTask {
  id: string
  title: string
  topicTitle: string | null
  deadline: string | null
  status: string
  isCompleted: boolean
  position: number
}
interface TodayMaterial {
  id: string
  title: string
  topicTitle: string
  type: string
  completedAmount: number
  totalAmount: number
  progressPercent: number
}
interface TodayResponse {
  date: string
  tasks: TodayTask[]
  currentMaterial: TodayMaterial | null
  reflection: string | null
}
```

### Step 1.6 — Frontend view-model hook

Create `frontend/src/features/today/hooks/use-today-view-model.ts`:
- `useQuery` to fetch GET `/api/today`
- `useMutation` for toggle task (PATCH), optimistic update
- `useMutation` for save reflection (PATCH)
- `useMutation` for set tasks (PUT)
- Local state: `reflectionDraft` text input
- Expose: `today`, `isLoading`, `toggleTask(taskId)`, `saveReflection()`, `reflectionDraft/setReflectionDraft`

### Step 1.7 — Frontend view component

Create `frontend/src/features/today/components/today-view.tsx`:

Layout (top to bottom):
1. **Header**: "Today, {formatted date}"
2. **Focus Tasks section**: List of 1-3 tasks with checkboxes. Each shows title, topic name (if any), deadline badge (red if overdue). Checking a box calls toggleTask → strikes through + marks done.
3. **Current Material section** (if exists): Card showing material title, topic, type icon, progress bar with "{completed}/{total} {unit}". Link to material (or topic workspace).
4. **Micro-reflection section**: Text area with placeholder "What did I learn today?". Show as collapsed/subtle if empty, expanded if user interacts. Save button or auto-save on blur. If already saved, show the saved text with edit option.

Style: clean, minimal, Tailwind. No clutter — this page should feel calming and actionable.

### Step 1.8 — Frontend page route

Create `frontend/app/(private)/today/page.tsx`:
- Import and render `<TodayView />`
- Standard pattern matching other private pages

### Step 1.9 — Navigation

Update `frontend/src/shared/ui/private-shell.tsx`:
- Add "Today" as the **first** menu item in the sidebar navigation (above Dashboard)
- Route: `/today`

### Step 1.10 — Redirect logic

Update root page redirect: if user is authenticated, redirect to `/today` instead of `/dashboard`. The dashboard remains accessible from the sidebar.

Update `frontend/middleware.ts` to include `/today` in the protected routes list.

---

## Feature 2: Activity Heatmap

**Goal:** A GitHub-style contribution heatmap showing daily learning activity over the past year. Displayed on the dashboard. Activity = any history event (task completed, material updated, reflection saved, etc.).

### Step 2.1 — Backend endpoint

No new tables needed — query `history_events` table.

Add to `backend/internal/dashboard/`:

**model.go** — add:
```
ActivityDay      { Date string, Count int }
ActivityHeatmap  { Days []ActivityDay, Streak int, TotalActiveDays int }
```

**repo.go** — add method:
```
GetActivityHeatmap(ctx, userID, from, to time.Time) → []ActivityDay
```
SQL: `SELECT date_trunc('day', created_at)::date AS date, COUNT(*) AS count FROM history_events WHERE user_id = $1 AND created_at >= $2 AND created_at < $3 GROUP BY date ORDER BY date`

Also add:
```
GetCurrentStreak(ctx, userID) → int
```
SQL: starting from today, count consecutive days backward where at least 1 event exists. Use a recursive CTE or a window function approach:
```sql
WITH daily AS (
    SELECT DISTINCT date_trunc('day', created_at)::date AS d
    FROM history_events WHERE user_id = $1
), numbered AS (
    SELECT d, d - (ROW_NUMBER() OVER (ORDER BY d DESC))::int AS grp
    FROM daily WHERE d <= CURRENT_DATE
)
SELECT COUNT(*) FROM numbered WHERE grp = (SELECT grp FROM numbered WHERE d = CURRENT_DATE)
```
If today has no events, streak = 0.

**usecase.go** — add method:
```
GetActivityHeatmap(ctx, userID) → ActivityHeatmap
```
- Call repo with `from = today - 365 days`, `to = today + 1 day`
- Call GetCurrentStreak
- Count non-zero days for TotalActiveDays

**handler.go** — add handler:
```
GET /api/v1/dashboard/activity-heatmap → GetActivityHeatmap
```

### Step 2.2 — Wire route

In `server.go`, add the route inside the existing dashboard route group.

### Step 2.3 — Frontend API route

Create `frontend/app/api/dashboard/activity-heatmap/route.ts` — GET proxy.

### Step 2.4 — Frontend types

Add to `frontend/src/features/dashboard/types.ts`:
```ts
interface ActivityDay { date: string; count: number }
interface ActivityHeatmap { days: ActivityDay[]; streak: number; totalActiveDays: number }
```

### Step 2.5 — Frontend heatmap component

Create `frontend/src/features/dashboard/components/activity-heatmap.tsx`:

- Renders a grid of 53 columns (weeks) x 7 rows (days), like GitHub
- Each cell = one day, colored by intensity (0 events = gray, 1-2 = light green, 3-5 = medium, 6+ = dark green). Use 4-5 intensity levels.
- Tooltip on hover: "{date}: {count} activities"
- Month labels on top
- Day-of-week labels on left (Mon, Wed, Fri)
- Above the grid: "Current streak: {N} days" + "Active days: {N}/365"
- Responsive: on small screens, show last 6 months instead of 12

Implementation: pure CSS grid or SVG. No heavy library — keep it lightweight. A simple `<div>` grid with Tailwind classes is sufficient.

### Step 2.6 — Integrate into dashboard

Update `frontend/src/features/dashboard/components/dashboard-view.tsx`:
- Add `<ActivityHeatmap />` section to the dashboard
- Fetch heatmap data in the dashboard view-model hook or in the heatmap component itself (prefer self-contained query in the component)

---

## Feature 3: Topic Notes

**Goal:** Optional markdown notes attached to topics. Users can write notes while studying (reading a book, watching a course). Simple markdown editor with preview. Notes are per-topic, not per-material.

### Step 3.1 — Database migration

Add to the same migration file `000005_today_and_notes.up.sql`:

```sql
CREATE TABLE topic_notes (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topic_id   UUID NOT NULL,
    title      TEXT NOT NULL DEFAULT '',
    content    TEXT NOT NULL DEFAULT '',
    position   INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (topic_id, user_id) REFERENCES topics(id, user_id) ON DELETE CASCADE
);
CREATE INDEX idx_topic_notes_topic ON topic_notes(topic_id);
CREATE INDEX idx_topic_notes_user ON topic_notes(user_id);
```

Down migration: add `DROP TABLE IF EXISTS topic_notes;` (before the other drops).

### Step 3.2 — Backend domain: `internal/note`

Create `backend/internal/note/` with 4 files.

**model.go**:
```
Note { ID, UserID, TopicID, Title, Content, Position, CreatedAt, UpdatedAt }
CreateNoteRequest  { TopicID, Title, Content }
UpdateNoteRequest  { Title, Content }
NoteResponse       { ID, TopicID, Title, Content, Position, CreatedAt, UpdatedAt }
```

Repository interface:
```
Repository {
    Create(ctx, note) → Note
    GetByID(ctx, userID, noteID) → Note
    ListByTopic(ctx, userID, topicID) → []Note
    Update(ctx, userID, noteID, title, content) → Note
    Delete(ctx, userID, noteID) error
    Reorder(ctx, userID, topicID, noteIDs []uuid.UUID) error
}
```

Errors: `ErrNoteNotFound`.

**repo.go** — standard pgx implementation:
- All queries filter by `user_id` for isolation
- `ListByTopic`: ORDER BY position, created_at
- `Reorder`: UPDATE position for each noteID based on array index

**usecase.go**:
- CRUD operations + recording history events (entity_type="note")
- `Create`: validates topic exists for user, creates note, records event
- `Update`: validates ownership, updates, records event
- `Delete`: validates ownership, deletes, records event

**handler.go**:
- `POST   /api/v1/topics/{topicID}/notes`       → Create
- `GET    /api/v1/topics/{topicID}/notes`        → ListByTopic
- `GET    /api/v1/notes/{noteID}`                → GetByID
- `PUT    /api/v1/notes/{noteID}`                → Update
- `DELETE /api/v1/notes/{noteID}`                → Delete

### Step 3.3 — Wire into router

In `server.go`: initialize note domain, register routes in JWT-protected group.

### Step 3.4 — Frontend API routes

Create:
- `app/api/topics/[topicId]/notes/route.ts` — GET (list), POST (create)
- `app/api/notes/[noteId]/route.ts` — GET, PUT, DELETE

### Step 3.5 — Frontend types

Create `frontend/src/features/topics/types/note-types.ts` (or extend existing `types.ts`):
```ts
interface TopicNote {
  id: string
  topicId: string
  title: string
  content: string
  position: number
  createdAt: string
  updatedAt: string
}
```

### Step 3.6 — Notes UI components

Create `frontend/src/features/topics/components/topic-notes.tsx`:

- **Notes list**: collapsible section in the topic workspace, showing note titles with preview
- **Note editor**: clicking a note opens an inline editor
  - Title input field
  - Textarea for markdown content (plain textarea, no WYSIWYG library needed for MVP)
  - Auto-save on blur or after 2s debounce
  - Simple markdown preview toggle (render markdown to HTML using a lightweight lib — or just show raw markdown for MVP)
- **Create note**: "+" button creates a new blank note
- **Delete note**: delete button with confirmation

Keep it simple — a textarea with auto-save is already valuable. Markdown rendering can be enhanced later.

### Step 3.7 — Integrate into topic workspace

Update `frontend/src/features/topics/components/topic-workspace-view.tsx`:
- Add `<TopicNotes topicId={topicId} />` section between the existing tasks and materials sections
- The section should be collapsible and labeled "Notes"

Update `frontend/src/features/topics/hooks/use-topic-workspace-view-model.ts`:
- Add queries/mutations for notes, or keep them self-contained in the TopicNotes component (preferred for encapsulation)

---

## Implementation Order

Execute features sequentially: complete Feature 1, then Feature 2, then Feature 3.

Within each feature, follow the step order (migration → backend → router wiring → frontend API → types → hook → component → page).

### Checklist

**Feature 1: Today View**
- [x] Step 1.1 — Migration (daily_plans + daily_plan_items tables)
- [x] Step 1.2 — Backend `internal/today` (model, repo, usecase, handler)
- [x] Step 1.3 — Router wiring in server.go
- [x] Step 1.4 — Frontend API proxy routes
- [x] Step 1.5 — Frontend types
- [x] Step 1.6 — View-model hook
- [x] Step 1.7 — View component
- [x] Step 1.8 — Page route
- [x] Step 1.9 — Navigation update
- [x] Step 1.10 — Redirect logic update

**Feature 2: Activity Heatmap**
- [x] Step 2.1 — Backend endpoint (model, repo, usecase, handler in dashboard domain)
- [x] Step 2.2 — Router wiring
- [x] Step 2.3 — Frontend API route
- [x] Step 2.4 — Frontend types
- [x] Step 2.5 — Heatmap component
- [x] Step 2.6 — Dashboard integration

**Feature 3: Topic Notes**
- [x] Step 3.1 — Migration (topic_notes table)
- [x] Step 3.2 — Backend `internal/note` (model, repo, usecase, handler)
- [x] Step 3.3 — Router wiring
- [x] Step 3.4 — Frontend API routes
- [x] Step 3.5 — Frontend types
- [x] Step 3.6 — Notes UI components
- [x] Step 3.7 — Topic workspace integration

---

## Notes for the Agent

- **Follow existing patterns exactly.** Look at how `task` or `material` domains are structured before writing new code. Copy the error handling, context extraction, response formatting patterns.
- **One migration file** for all schema changes (`000005_today_and_notes`). Check what the latest migration number is before creating.
- **Backend contracts**: all JSON field names use `snake_case`. Frontend types use `camelCase` with mapping in API routes.
- **History events**: use the `WithRecorder` pattern from existing use cases. Entity types: `"daily_plan"`, `"note"`. Event names: `"entity.created"`, `"entity.updated"`, `"entity.deleted"`, `"daily_reflection.saved"`.
- **Frontend API routes**: always use `createBackendClient()` from `@shared/api/backend-client`. Handle errors with `NextResponse.json()`.
- **View-model hooks**: use `useQuery` / `useMutation` from TanStack Query. Invalidate relevant queries on mutation success.
- **UI copy / i18n**: add new strings to `frontend/src/shared/i18n/ui-copy.ts` following the existing pattern.
- **Testing**: write backend unit tests for usecase and handler layers. Frontend: at minimum, type-check compiles with `npx tsc --noEmit`.
- **Do not modify** existing features unless explicitly required by the plan (e.g., navigation update, redirect change).

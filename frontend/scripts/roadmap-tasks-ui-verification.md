# Roadmap and tasks UI review verification

## Preconditions
- Start real backend stack (for example from repo root): `docker compose -f build/docker-compose.yml up -d --build`
- Start frontend against real backend:
  - `$env:BACKEND_API_URL="http://127.0.0.1:8080"`
  - `npm run start -- --hostname 127.0.0.1 --port 3025`
- Open browser at `http://127.0.0.1:3025`, register/login with a real test account.
- Ensure there is at least one roadmap topic and one task.

## Scenario 1: roadmap topic card does not show description
1. Open `/roadmap`.
2. Locate any topic card with non-empty description in the edit form.
3. Verify card shows title, status, progress, counters.
4. Verify full topic description text is not rendered in the card body.
5. Result: PASS/FAIL.

## Scenario 2: tasks full edit flow updates UI
1. Open `/tasks`.
2. In any card, click edit button.
3. In edit modal update title, description, and deadline.
4. Click Save.
5. Verify modal closes.
6. Verify updated values are visible in the task card.
7. Result: PASS/FAIL.

## Scenario 3: tasks edit API error keeps modal open (real backend race case)
1. Open `/tasks` in two browser tabs.
2. In tab A click edit on a task card and keep the edit modal open.
3. In tab B delete the same task card and wait for successful UI update.
4. Return to tab A, change title and click Save.
5. Verify edit modal remains open and UI shows an API error message (task was removed on backend).
6. Result: PASS/FAIL.

## Scenario 4: tasks card does not show drag-hint text
1. Open `/tasks`.
2. Inspect visible text in task cards.
3. Verify no helper text with drag-hint semantics is shown (for example, no text like `Drag`/`Move`).
4. Result: PASS/FAIL.

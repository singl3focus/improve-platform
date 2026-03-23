# Roadmap and tasks UI review verification

## Preconditions
- Start mock backend: `node ./scripts/roadmap-tasks-ui-review-backend.mjs`
- Start frontend against mock backend:
  - `$env:BACKEND_API_URL="http://127.0.0.1:8087"`
  - `npm run start -- --hostname 127.0.0.1 --port 3025`
- Open browser at `http://127.0.0.1:3025` and set cookies:
  - `improve_access_token=ui-review-access-token`
  - `improve_refresh_token=ui-review-refresh-token`

## Scenario 1: roadmap topic card does not show description
1. Open `/roadmap`.
2. Locate card `HTML & CSS`.
3. Verify card shows title, status, progress, counters.
4. Verify text `Core markup and styling skills for UI verification.` is not visible in the card.
5. Result: PASS/FAIL.

## Scenario 2: tasks full edit flow updates UI
1. Open `/tasks`.
2. In any card, click edit button.
3. In edit modal update title, description, and deadline.
4. Click Save.
5. Verify modal closes.
6. Verify updated values are visible in the task card.
7. Result: PASS/FAIL.

## Scenario 3: tasks edit API error keeps modal open
1. Enable backend error mode:
   - `Invoke-WebRequest -Method POST -Uri "http://127.0.0.1:8087/__mock/scenario" -ContentType "application/json" -Body '{"taskUpdateMode":"error"}'`
2. Open `/tasks`, click edit on a card.
3. Change task title and click Save.
4. Verify edit modal remains open.
5. Verify error message is shown in the modal.
6. Switch backend mode back to ok:
   - `Invoke-WebRequest -Method POST -Uri "http://127.0.0.1:8087/__mock/scenario" -ContentType "application/json" -Body '{"taskUpdateMode":"ok"}'`
7. Result: PASS/FAIL.

## Scenario 4: tasks card does not show drag-hint text
1. Open `/tasks`.
2. Inspect visible text in task cards.
3. Verify no helper text with drag-hint semantics is shown (for example, no text like `Drag`/`Перетащите`).
4. Result: PASS/FAIL.

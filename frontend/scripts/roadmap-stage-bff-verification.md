# Roadmap stage BFF verification scenarios

## Preconditions
- User is authenticated in the web app.
- Roadmap page is accessible.
- Open browser devtools Network tab.

## Scenario 1: create stage happy path
1. Open roadmap page.
2. In stage management panel enter stage title and valid position.
3. Submit create action.
4. Verify request `POST /api/roadmap/stages` returns `201`.
5. Verify response contains created stage payload from backend.
6. Verify stage appears in UI after automatic reload.

## Scenario 2: create stage validation error
1. Open roadmap page.
2. Leave stage title empty.
3. Submit create action.
4. Verify no backend call is made.
5. Verify UI shows validation message about required stage title.

## Scenario 3: update stage happy path
1. Click stage edit action.
2. Change title or position to valid values.
3. Submit save action.
4. Verify request `PUT /api/roadmap/stages/{stageId}` returns `200`.
5. Verify stage data is updated in UI after automatic reload.

## Scenario 4: update stage validation error
1. Click stage edit action.
2. Clear stage title.
3. Submit save action.
4. Verify no backend call is made.
5. Verify UI shows validation message about required stage title.

## Scenario 5: delete stage happy path
1. Click stage delete action.
2. Accept browser confirmation dialog.
3. Verify request `DELETE /api/roadmap/stages/{stageId}` returns `200`.
4. Verify deleted stage is removed from UI after automatic reload.

## Scenario 6: delete stage cancel path
1. Click stage delete action.
2. Reject browser confirmation dialog.
3. Verify no `DELETE` request is sent.
4. Verify stage remains unchanged in UI.

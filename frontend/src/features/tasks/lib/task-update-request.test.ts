import test from "node:test";
import assert from "node:assert/strict";
import type { BackendTaskResponse } from "@shared/api/backend-contracts";
import { resolveTaskUpdateRequest } from "./task-update-request";

const CURRENT_TASK: BackendTaskResponse = {
  id: "task-1",
  topic_id: "topic-1",
  title: "Current title",
  description: "Current description",
  status: "new",
  deadline: "2026-04-05",
  position: 3,
  is_overdue: false
};

test("resolveTaskUpdateRequest preserves current values when payload fields are omitted", () => {
  const result = resolveTaskUpdateRequest(CURRENT_TASK, {});

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.deepEqual(result.value, {
    title: "Current title",
    description: "Current description",
    topicId: "topic-1",
    deadline: "2026-04-05"
  });
});

test("resolveTaskUpdateRequest allows clearing deadline with an empty string", () => {
  const result = resolveTaskUpdateRequest(CURRENT_TASK, { deadline: "" });

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.value.deadline, null);
});

test("resolveTaskUpdateRequest rejects an explicitly empty title", () => {
  const result = resolveTaskUpdateRequest(CURRENT_TASK, { title: "   " });

  assert.deepEqual(result, {
    ok: false,
    message: "Title must be a non-empty string."
  });
});

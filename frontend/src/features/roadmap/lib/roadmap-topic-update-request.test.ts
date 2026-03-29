import test from "node:test";
import assert from "node:assert/strict";
import { resolveRoadmapTopicUpdateRequest } from "./roadmap-topic-update-request";

const CURRENT_TOPIC = {
  title: "Current topic",
  description: "Current description",
  status: "in_progress" as const
};

test("resolveRoadmapTopicUpdateRequest preserves title and description for partial updates", () => {
  const result = resolveRoadmapTopicUpdateRequest(CURRENT_TOPIC, {
    target_date: "2026-04-12"
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.deepEqual(result.value, {
    title: "Current topic",
    description: "Current description",
    status: null,
    startDate: undefined,
    targetDate: "2026-04-12"
  });
});

test("resolveRoadmapTopicUpdateRequest converts empty date strings to null", () => {
  const result = resolveRoadmapTopicUpdateRequest(CURRENT_TOPIC, {
    start_date: ""
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.value.startDate, null);
});

test("resolveRoadmapTopicUpdateRequest rejects invalid status values", () => {
  const result = resolveRoadmapTopicUpdateRequest(CURRENT_TOPIC, {
    status: "archived"
  });

  assert.deepEqual(result, {
    ok: false,
    message: "Invalid topic status. Allowed: not_started, in_progress, paused, completed."
  });
});

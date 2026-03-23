import test from "node:test";
import assert from "node:assert/strict";
import {
  getAllowedRoadmapTopicStatuses,
  getRoadmapTopicStatuses,
  isRoadmapTopicStatus,
  validateRoadmapTopicStatusChange
} from "./roadmap-topic-status";

test("getRoadmapTopicStatuses returns all domain status values in UI order", () => {
  assert.deepEqual(getRoadmapTopicStatuses(), [
    "not_started",
    "in_progress",
    "paused",
    "completed"
  ]);
});

test("isRoadmapTopicStatus accepts only supported roadmap topic statuses", () => {
  assert.equal(isRoadmapTopicStatus("not_started"), true);
  assert.equal(isRoadmapTopicStatus("paused"), true);
  assert.equal(isRoadmapTopicStatus("done"), false);
  assert.equal(isRoadmapTopicStatus("blocked"), false);
});

test("validateRoadmapTopicStatusChange allows a valid manual transition from paused to in_progress", () => {
  assert.deepEqual(
    validateRoadmapTopicStatusChange({
      currentStatus: "paused",
      nextStatus: "in_progress",
      isBlocked: false
    }),
    { ok: true }
  );
});

test("validateRoadmapTopicStatusChange rejects invalid transition from not_started to completed", () => {
  assert.deepEqual(
    validateRoadmapTopicStatusChange({
      currentStatus: "not_started",
      nextStatus: "completed",
      isBlocked: false
    }),
    {
      ok: false,
      reason: "invalid_transition",
      allowedStatuses: ["in_progress"]
    }
  );
});

test("validateRoadmapTopicStatusChange rejects blocked topic transition to in_progress", () => {
  assert.deepEqual(
    validateRoadmapTopicStatusChange({
      currentStatus: "not_started",
      nextStatus: "in_progress",
      isBlocked: true
    }),
    {
      ok: false,
      reason: "blocked"
    }
  );
});

test("validateRoadmapTopicStatusChange allows saving unchanged blocked topic status", () => {
  assert.deepEqual(
    validateRoadmapTopicStatusChange({
      currentStatus: "paused",
      nextStatus: "paused",
      isBlocked: true
    }),
    { ok: true }
  );
});

test("getAllowedRoadmapTopicStatuses mirrors backend transition map for completed topics", () => {
  assert.deepEqual(getAllowedRoadmapTopicStatuses("completed"), ["in_progress"]);
});

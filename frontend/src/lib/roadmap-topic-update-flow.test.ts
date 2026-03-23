import test from "node:test";
import assert from "node:assert/strict";
import { buildRoadmapTopicUpdatePlan } from "./roadmap-topic-update-flow";

test("buildRoadmapTopicUpdatePlan adds status PATCH step for a valid changed status", () => {
  const result = buildRoadmapTopicUpdatePlan({
    currentTopic: {
      status: "in_progress",
      isBlocked: false,
      blockedReason: null,
      position: 3,
      startDate: "2026-03-01",
      targetDate: "2026-03-10"
    },
    request: {
      title: "CSS layout",
      description: "Flexbox and grid",
      status: "paused"
    }
  });

  assert.deepEqual(result, {
    ok: true,
    responseStatus: "paused",
    statusPayload: {
      status: "paused"
    },
    topicPayload: {
      title: "CSS layout",
      description: "Flexbox and grid",
      position: 3,
      start_date: "2026-03-01",
      target_date: "2026-03-10"
    }
  });
});

test("buildRoadmapTopicUpdatePlan rejects invalid status transition before PATCH flow", () => {
  const result = buildRoadmapTopicUpdatePlan({
    currentTopic: {
      status: "not_started",
      isBlocked: false,
      blockedReason: null,
      position: 1,
      startDate: null,
      targetDate: null
    },
    request: {
      title: "JavaScript basics",
      description: "",
      status: "completed"
    }
  });

  assert.deepEqual(result, {
    ok: false,
    httpStatus: 400,
    code: "invalid_status",
    message:
      'Invalid topic status transition from "not_started" to "completed". Allowed: in_progress.'
  });
});

test("buildRoadmapTopicUpdatePlan rejects blocked status transition before PATCH flow", () => {
  const result = buildRoadmapTopicUpdatePlan({
    currentTopic: {
      status: "not_started",
      isBlocked: true,
      blockedReason: "Complete HTML & CSS first",
      position: 1,
      startDate: null,
      targetDate: null
    },
    request: {
      title: "JavaScript basics",
      description: "",
      status: "in_progress"
    }
  });

  assert.deepEqual(result, {
    ok: false,
    httpStatus: 409,
    code: "topic_blocked",
    message:
      'Blocked topic cannot be moved manually to "in_progress" until prerequisites are completed. Reason: Complete HTML & CSS first'
  });
});

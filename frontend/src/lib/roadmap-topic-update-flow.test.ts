import test from "node:test";
import assert from "node:assert/strict";
import { buildRoadmapTopicUpdatePlan } from "./roadmap-topic-update-flow";

test("buildRoadmapTopicUpdatePlan adds status PATCH step for a valid changed status", () => {
  const result = buildRoadmapTopicUpdatePlan({
    currentTopic: {
      status: "in_progress",
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

test("buildRoadmapTopicUpdatePlan allows not_started to in_progress transition", () => {
  const result = buildRoadmapTopicUpdatePlan({
    currentTopic: {
      status: "not_started",
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

  assert.equal(result.ok, true);
});

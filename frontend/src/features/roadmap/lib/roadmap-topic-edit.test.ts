import test from "node:test";
import assert from "node:assert/strict";
import { prepareRoadmapTopicEditSubmission } from "./roadmap-topic-edit";

test("prepareRoadmapTopicEditSubmission returns trimmed payload for a valid status change from edit modal", () => {
  const result = prepareRoadmapTopicEditSubmission({
    topic: {
      status: "in_progress"
    },
    draft: {
      title: "  CSS layout  ",
      description: "  Flexbox and grid  ",
      status: "paused"
    }
  });

  assert.deepEqual(result, {
    ok: true,
    payload: {
      title: "CSS layout",
      description: "Flexbox and grid",
      status: "paused"
    },
    statusChanged: true
  });
});

test("prepareRoadmapTopicEditSubmission rejects invalid transition before modal submit reaches API flow", () => {
  const result = prepareRoadmapTopicEditSubmission({
    topic: {
      status: "not_started"
    },
    draft: {
      title: "JavaScript basics",
      description: "",
      status: "completed"
    }
  });

  assert.deepEqual(result, {
    ok: false,
    reason: "invalid_transition",
    validationResult: {
      ok: false,
      reason: "invalid_transition",
      allowedStatuses: ["in_progress"]
    }
  });
});

test("prepareRoadmapTopicEditSubmission allows transition from not_started to in_progress", () => {
  const result = prepareRoadmapTopicEditSubmission({
    topic: {
      status: "not_started"
    },
    draft: {
      title: "JavaScript basics",
      description: "Prerequisites pending",
      status: "in_progress"
    }
  });

  assert.deepEqual(result, {
    ok: true,
    payload: {
      title: "JavaScript basics",
      description: "Prerequisites pending",
      status: "in_progress"
    },
    statusChanged: true
  });
});

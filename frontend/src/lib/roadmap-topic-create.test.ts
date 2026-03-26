import test from "node:test";
import assert from "node:assert/strict";
import { buildTopicCreatePayload } from "./roadmap-topic-create";

test("buildTopicCreatePayload keeps non-directional position flow", () => {
  const payload = buildTopicCreatePayload({
    title: "Topic",
    description: "Description",
    position: 7
  });

  assert.deepEqual(payload, {
    title: "Topic",
    description: "Description",
    position: 7
  });
});

test("buildTopicCreatePayload omits invalid non-directional position", () => {
  const payload = buildTopicCreatePayload({
    title: "Topic",
    description: "Description",
    position: 0
  });

  assert.deepEqual(payload, {
    title: "Topic",
    description: "Description"
  });
});

test("buildTopicCreatePayload prefers directional contract over position", () => {
  const payload = buildTopicCreatePayload({
    title: "Topic",
    description: "Description",
    position: 1,
    anchor: {
      parentId: "topic-parent",
      direction: "left"
    }
  });

  assert.deepEqual(payload, {
    title: "Topic",
    description: "Description",
    direction: "left",
    relative_to_topic_id: "topic-parent"
  });
});

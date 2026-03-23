import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDirectionalDependencyPlan,
  buildTopicCreatePayload
} from "./roadmap-topic-create";

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

test("buildDirectionalDependencyPlan keeps expected parent -> created dependency as-is", () => {
  const plan = buildDirectionalDependencyPlan({
    roadmapPayload: {
      topics: [
        {
          id: "topic-parent",
          dependencies: ["topic-created"]
        },
        {
          id: "topic-created",
          dependencies: []
        }
      ]
    },
    parentTopicId: "topic-parent",
    createdTopicId: "topic-created"
  });

  assert.deepEqual(plan, {
    shouldAddParentDependsOnCreated: false,
    shouldRemoveCreatedDependsOnParent: false
  });
});

test("buildDirectionalDependencyPlan requests repair for reverse dependency", () => {
  const plan = buildDirectionalDependencyPlan({
    roadmapPayload: {
      topics: [
        {
          id: "topic-parent",
          dependencies: []
        },
        {
          id: "topic-created",
          dependencies: ["topic-parent"]
        }
      ]
    },
    parentTopicId: "topic-parent",
    createdTopicId: "topic-created"
  });

  assert.deepEqual(plan, {
    shouldAddParentDependsOnCreated: true,
    shouldRemoveCreatedDependsOnParent: true
  });
});

test("buildDirectionalDependencyPlan supports staged payload with prerequisiteTopicIds", () => {
  const plan = buildDirectionalDependencyPlan({
    roadmapPayload: {
      stages: [
        {
          id: "stage-1",
          topics: [
            {
              id: "topic-parent",
              prerequisiteTopicIds: []
            },
            {
              id: "topic-created",
              prerequisiteTopicIds: ["topic-parent"]
            }
          ]
        }
      ]
    },
    parentTopicId: "topic-parent",
    createdTopicId: "topic-created"
  });

  assert.deepEqual(plan, {
    shouldAddParentDependsOnCreated: true,
    shouldRemoveCreatedDependsOnParent: true
  });
});

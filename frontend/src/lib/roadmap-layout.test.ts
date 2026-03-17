import test from "node:test";
import assert from "node:assert/strict";
import { buildRoadmapConnections, readGraphSize } from "./roadmap-layout";
import type { RoadmapResponse } from "./roadmap-types";

function createRoadmapFixture(): RoadmapResponse {
  return {
    stages: [
      {
        id: "stage-a",
        title: "Stage A",
        topics: [
          {
            id: "topic-a",
            stageId: "stage-a",
            title: "Topic A",
            description: "",
            position: 1,
            status: "in_progress",
            progressPercent: 20,
            isBlocked: false,
            blockedReason: null,
            tasksCount: 0,
            materialsCount: 0,
            prerequisiteTopicIds: []
          },
          {
            id: "topic-b",
            stageId: "stage-a",
            title: "Topic B",
            description: "",
            position: 2,
            status: "not_started",
            progressPercent: 0,
            isBlocked: false,
            blockedReason: null,
            tasksCount: 0,
            materialsCount: 0,
            prerequisiteTopicIds: ["topic-a"]
          }
        ]
      }
    ]
  };
}

test("buildRoadmapConnections builds edge coordinates for prerequisite links", () => {
  const roadmap = createRoadmapFixture();
  const topicRects = new Map([
    [
      "topic-a",
      {
        left: 100,
        top: 40,
        width: 120,
        bottom: 120
      }
    ],
    [
      "topic-b",
      {
        left: 340,
        top: 260,
        width: 120,
        bottom: 340
      }
    ]
  ]);

  const connections = buildRoadmapConnections(roadmap, { left: 20, top: 10 }, topicRects);

  assert.deepEqual(connections, [
    {
      fromId: "topic-a",
      toId: "topic-b",
      x1: 140,
      y1: 110,
      x2: 380,
      y2: 250
    }
  ]);
});

test("buildRoadmapConnections skips links when source or target topic rect is missing", () => {
  const roadmap = createRoadmapFixture();
  const topicRects = new Map([
    [
      "topic-a",
      {
        left: 100,
        top: 40,
        width: 120,
        bottom: 120
      }
    ]
  ]);

  const connections = buildRoadmapConnections(roadmap, { left: 20, top: 10 }, topicRects);
  assert.deepEqual(connections, []);
});

test("readGraphSize enforces minimum render size of 1x1", () => {
  const size = readGraphSize({
    clientWidth: 0,
    clientHeight: 0
  } as Pick<HTMLElement, "clientWidth" | "clientHeight">);

  assert.deepEqual(size, {
    width: 1,
    height: 1
  });
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRoadmapConnections,
  buildTopicGridPlacementById,
  buildTopicGridColumnById,
  readGraphSize
} from "./roadmap-layout";
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

function createStageFreeRoadmapFixture(): RoadmapResponse {
  return {
    topics: [
      {
        id: "topic-a",
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
      x1: 232,
      y1: 70,
      x2: 302,
      y2: 290
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

test("buildRoadmapConnections supports stage-free flat topics payload", () => {
  const roadmap = createStageFreeRoadmapFixture();
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
      x1: 232,
      y1: 70,
      x2: 302,
      y2: 290
    }
  ]);
});

test("readGraphSize enforces minimum render size of 1x1", () => {
  const size = readGraphSize({
    clientWidth: 0,
    clientHeight: 0,
    scrollWidth: 0,
    scrollHeight: 0
  } as Pick<HTMLElement, "clientWidth" | "clientHeight"> & {
    scrollWidth?: number;
    scrollHeight?: number;
  });

  assert.deepEqual(size, {
    width: 1,
    height: 1
  });
});

test("readGraphSize expands to scrollable graph area when content is larger than viewport", () => {
  const size = readGraphSize({
    clientWidth: 900,
    clientHeight: 560,
    scrollWidth: 1440,
    scrollHeight: 1280
  } as Pick<HTMLElement, "clientWidth" | "clientHeight"> & {
    scrollWidth?: number;
    scrollHeight?: number;
  });

  assert.deepEqual(size, {
    width: 1440,
    height: 1280
  });
});

test("buildTopicGridColumnById spreads topics with duplicate positions into separate columns", () => {
  const roadmap: RoadmapResponse = {
    stages: [
      {
        id: "stage-a",
        title: "Stage A",
        topics: [
          {
            id: "topic-b",
            stageId: "stage-a",
            title: "Topic B",
            description: "",
            position: 4,
            status: "not_started",
            progressPercent: 0,
            isBlocked: false,
            blockedReason: null,
            tasksCount: 0,
            materialsCount: 0,
            prerequisiteTopicIds: []
          },
          {
            id: "topic-a",
            stageId: "stage-a",
            title: "Topic A",
            description: "",
            position: 4,
            status: "in_progress",
            progressPercent: 30,
            isBlocked: false,
            blockedReason: null,
            tasksCount: 0,
            materialsCount: 0,
            prerequisiteTopicIds: []
          },
          {
            id: "topic-c",
            stageId: "stage-a",
            title: "Topic C",
            description: "",
            position: 6,
            status: "not_started",
            progressPercent: 0,
            isBlocked: false,
            blockedReason: null,
            tasksCount: 0,
            materialsCount: 0,
            prerequisiteTopicIds: []
          }
        ]
      }
    ]
  };

  const topicColumns = buildTopicGridColumnById(roadmap.stages ?? []);

  assert.equal(topicColumns.get("topic-a"), 1);
  assert.equal(topicColumns.get("topic-b"), 2);
  assert.equal(topicColumns.get("topic-c"), 3);
});

test("child-topic layout keeps parent and child separate while dependency edge is preserved", () => {
  const roadmap: RoadmapResponse = {
    stages: [
      {
        id: "stage-a",
        title: "Stage A",
        topics: [
          {
            id: "topic-parent",
            stageId: "stage-a",
            title: "Parent",
            description: "",
            position: 1,
            status: "in_progress",
            progressPercent: 20,
            isBlocked: false,
            blockedReason: null,
            tasksCount: 1,
            materialsCount: 1,
            prerequisiteTopicIds: []
          },
          {
            id: "topic-child",
            stageId: "stage-a",
            title: "Child",
            description: "",
            position: 1,
            status: "not_started",
            progressPercent: 0,
            isBlocked: true,
            blockedReason: "blocked",
            tasksCount: 0,
            materialsCount: 0,
            prerequisiteTopicIds: ["topic-parent"]
          }
        ]
      }
    ]
  };

  const topicColumns = buildTopicGridColumnById(roadmap.stages ?? []);
  const topicPlacement = buildTopicGridPlacementById(roadmap.stages ?? []);
  const parentPlacement = topicPlacement.get("topic-parent");
  const childPlacement = topicPlacement.get("topic-child");
  assert.ok(parentPlacement);
  assert.ok(childPlacement);
  assert.ok(childPlacement!.row > parentPlacement!.row);
  assert.equal(topicColumns.get("topic-parent"), topicColumns.get("topic-child"));

  const topicRects = new Map([
    [
      "topic-parent",
      {
        left: 100,
        top: 40,
        width: 120,
        bottom: 120
      }
    ],
    [
      "topic-child",
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
      fromId: "topic-parent",
      toId: "topic-child",
      x1: 232,
      y1: 70,
      x2: 302,
      y2: 290
    }
  ]);
});

test("buildRoadmapConnections keeps side anchors for topics on the same row", () => {
  const roadmap: RoadmapResponse = {
    stages: [
      {
        id: "stage-a",
        title: "Stage A",
        topics: [
          {
            id: "topic-parent",
            stageId: "stage-a",
            title: "Parent",
            description: "",
            position: 1,
            status: "in_progress",
            progressPercent: 20,
            isBlocked: false,
            blockedReason: null,
            tasksCount: 1,
            materialsCount: 1,
            prerequisiteTopicIds: []
          },
          {
            id: "topic-child",
            stageId: "stage-a",
            title: "Child",
            description: "",
            position: 2,
            status: "not_started",
            progressPercent: 0,
            isBlocked: false,
            blockedReason: null,
            tasksCount: 0,
            materialsCount: 0,
            prerequisiteTopicIds: ["topic-parent"]
          }
        ]
      }
    ]
  };
  const topicRects = new Map([
    [
      "topic-parent",
      {
        left: 100,
        top: 40,
        width: 120,
        bottom: 120
      }
    ],
    [
      "topic-child",
      {
        left: 340,
        top: 52,
        width: 120,
        bottom: 132
      }
    ]
  ]);

  const connections = buildRoadmapConnections(roadmap, { left: 20, top: 10 }, topicRects);

  assert.deepEqual(connections, [
    {
      fromId: "topic-parent",
      toId: "topic-child",
      x1: 232,
      y1: 70,
      x2: 302,
      y2: 82
    }
  ]);
});

test("buildRoadmapConnections keeps enough right-side clearance for visible arrowheads and link handles", () => {
  const roadmap: RoadmapResponse = {
    stages: [
      {
        id: "stage-a",
        title: "Stage A",
        topics: [
          {
            id: "topic-left",
            stageId: "stage-a",
            title: "Left",
            description: "",
            position: 1,
            status: "not_started",
            progressPercent: 0,
            isBlocked: false,
            blockedReason: null,
            tasksCount: 0,
            materialsCount: 0,
            prerequisiteTopicIds: ["topic-right"]
          },
          {
            id: "topic-right",
            stageId: "stage-a",
            title: "Right",
            description: "",
            position: 2,
            status: "in_progress",
            progressPercent: 30,
            isBlocked: false,
            blockedReason: null,
            tasksCount: 1,
            materialsCount: 1,
            prerequisiteTopicIds: []
          }
        ]
      }
    ]
  };

  const topicRects = new Map([
    [
      "topic-left",
      {
        left: 100,
        top: 52,
        width: 120,
        bottom: 132
      }
    ],
    [
      "topic-right",
      {
        left: 340,
        top: 40,
        width: 120,
        bottom: 120
      }
    ]
  ]);

  const connections = buildRoadmapConnections(roadmap, { left: 20, top: 10 }, topicRects);

  assert.deepEqual(connections, [
    {
      fromId: "topic-right",
      toId: "topic-left",
      x1: 302,
      y1: 70,
      x2: 232,
      y2: 82
    }
  ]);
});

test("buildTopicGridPlacementById keeps directional semantics for left right and below", () => {
  const roadmap: RoadmapResponse = {
    stages: [
      {
        id: "stage-a",
        title: "Stage A",
        topics: [
          {
            id: "topic-parent",
            stageId: "stage-a",
            title: "Parent",
            description: "",
            position: 5,
            status: "in_progress",
            progressPercent: 10,
            isBlocked: false,
            blockedReason: null,
            tasksCount: 0,
            materialsCount: 0,
            prerequisiteTopicIds: []
          },
          {
            id: "topic-left",
            stageId: "stage-a",
            title: "Left",
            description: "",
            position: 4,
            status: "not_started",
            progressPercent: 0,
            isBlocked: false,
            blockedReason: null,
            tasksCount: 0,
            materialsCount: 0,
            prerequisiteTopicIds: ["topic-parent"]
          },
          {
            id: "topic-right",
            stageId: "stage-a",
            title: "Right",
            description: "",
            position: 6,
            status: "not_started",
            progressPercent: 0,
            isBlocked: false,
            blockedReason: null,
            tasksCount: 0,
            materialsCount: 0,
            prerequisiteTopicIds: ["topic-parent"]
          },
          {
            id: "topic-below",
            stageId: "stage-a",
            title: "Below",
            description: "",
            position: 5,
            status: "not_started",
            progressPercent: 0,
            isBlocked: true,
            blockedReason: "blocked",
            tasksCount: 0,
            materialsCount: 0,
            prerequisiteTopicIds: ["topic-parent"]
          }
        ]
      }
    ]
  };

  const placementById = buildTopicGridPlacementById(roadmap.stages ?? []);
  const parent = placementById.get("topic-parent");
  const left = placementById.get("topic-left");
  const right = placementById.get("topic-right");
  const below = placementById.get("topic-below");

  assert.ok(parent);
  assert.ok(left);
  assert.ok(right);
  assert.ok(below);

  assert.equal(left!.row, parent!.row);
  assert.equal(right!.row, parent!.row);
  assert.ok(left!.column < parent!.column);
  assert.ok(right!.column > parent!.column);
  assert.ok(below!.row > parent!.row);
});

test("buildTopicGridPlacementById avoids collisions for sequential directional children", () => {
  const roadmap: RoadmapResponse = {
    stages: [
      {
        id: "stage-a",
        title: "Stage A",
        topics: [
          {
            id: "topic-parent",
            stageId: "stage-a",
            title: "Parent",
            description: "",
            position: 10,
            status: "in_progress",
            progressPercent: 10,
            isBlocked: false,
            blockedReason: null,
            tasksCount: 0,
            materialsCount: 0,
            prerequisiteTopicIds: []
          },
          {
            id: "topic-right-1",
            stageId: "stage-a",
            title: "Right 1",
            description: "",
            position: 11,
            status: "not_started",
            progressPercent: 0,
            isBlocked: false,
            blockedReason: null,
            tasksCount: 0,
            materialsCount: 0,
            prerequisiteTopicIds: ["topic-parent"]
          },
          {
            id: "topic-right-2",
            stageId: "stage-a",
            title: "Right 2",
            description: "",
            position: 11,
            status: "not_started",
            progressPercent: 0,
            isBlocked: false,
            blockedReason: null,
            tasksCount: 0,
            materialsCount: 0,
            prerequisiteTopicIds: ["topic-parent"]
          },
          {
            id: "topic-below-1",
            stageId: "stage-a",
            title: "Below 1",
            description: "",
            position: 10,
            status: "not_started",
            progressPercent: 0,
            isBlocked: true,
            blockedReason: "blocked",
            tasksCount: 0,
            materialsCount: 0,
            prerequisiteTopicIds: ["topic-parent"]
          },
          {
            id: "topic-below-2",
            stageId: "stage-a",
            title: "Below 2",
            description: "",
            position: 10,
            status: "not_started",
            progressPercent: 0,
            isBlocked: true,
            blockedReason: "blocked",
            tasksCount: 0,
            materialsCount: 0,
            prerequisiteTopicIds: ["topic-parent"]
          }
        ]
      }
    ]
  };

  const placementById = buildTopicGridPlacementById(roadmap.stages ?? []);
  const occupiedKeys = new Set<string>();

  for (const placement of placementById.values()) {
    const key = `${placement.row}:${placement.column}`;
    assert.equal(occupiedKeys.has(key), false);
    occupiedKeys.add(key);
  }
});

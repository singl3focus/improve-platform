import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRoadmapConnections,
  buildTopicGridPlacementById,
  buildTopicGridColumnById,
  readGraphSize
} from "./roadmap-layout";
import type { RoadmapResponse } from "../types";

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
      x1: 200,
      y1: 70,
      x2: 320,
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
      x1: 200,
      y1: 70,
      x2: 320,
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
  assert.equal(topicColumns.get("topic-b"), 3);
  assert.equal(topicColumns.get("topic-c"), 5);
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
      x1: 200,
      y1: 70,
      x2: 320,
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
      x1: 200,
      y1: 70,
      x2: 320,
      y2: 82
    }
  ]);
});

test("buildRoadmapConnections links left topic to right topic using inner horizontal anchors", () => {
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
      x1: 320,
      y1: 70,
      x2: 200,
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
  assert.equal(below!.column, parent!.column);
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
    assert.equal(occupiedKeys.has(key), false, `Collision at ${key}`);
    occupiedKeys.add(key);
  }

  const parent = placementById.get("topic-parent");
  const right1 = placementById.get("topic-right-1");
  const right2 = placementById.get("topic-right-2");
  const below1 = placementById.get("topic-below-1");
  const below2 = placementById.get("topic-below-2");

  assert.ok(parent);
  assert.ok(right1);
  assert.ok(right2);
  assert.ok(below1);
  assert.ok(below2);

  // Right children stack vertically in a column to the right
  assert.equal(right1!.column, parent!.column + 1);
  assert.equal(right2!.column, parent!.column + 1);
  assert.equal(right1!.row, parent!.row);
  assert.equal(right2!.row, parent!.row + 1);

  // Below children spread horizontally in a row, placed after side children
  assert.ok(below1!.row > right2!.row);
  assert.equal(below1!.row, below2!.row);
  assert.equal(below1!.column, parent!.column);
  assert.equal(below2!.column, parent!.column + 1);
});

test("buildTopicGridPlacementById stacks left children vertically in a column", () => {
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
            tasksCount: 0,
            materialsCount: 0,
            prerequisiteTopicIds: []
          },
          {
            id: "topic-left-1",
            stageId: "stage-a",
            title: "Left 1",
            description: "",
            position: 9,
            status: "not_started",
            progressPercent: 0,
            tasksCount: 0,
            materialsCount: 0,
            prerequisiteTopicIds: ["topic-parent"]
          },
          {
            id: "topic-left-2",
            stageId: "stage-a",
            title: "Left 2",
            description: "",
            position: 9,
            status: "not_started",
            progressPercent: 0,
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
  const left1 = placementById.get("topic-left-1");
  const left2 = placementById.get("topic-left-2");

  assert.ok(parent);
  assert.ok(left1);
  assert.ok(left2);

  // Same column, different rows
  assert.equal(left1!.column, parent!.column - 1);
  assert.equal(left2!.column, parent!.column - 1);
  assert.equal(left1!.row, parent!.row);
  assert.equal(left2!.row, parent!.row + 1);
});

test("buildTopicGridPlacementById stacks right children vertically in a column", () => {
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
  const right1 = placementById.get("topic-right-1");
  const right2 = placementById.get("topic-right-2");

  assert.ok(parent);
  assert.ok(right1);
  assert.ok(right2);

  // Same column, different rows
  assert.equal(right1!.column, parent!.column + 1);
  assert.equal(right2!.column, parent!.column + 1);
  assert.equal(right1!.row, parent!.row);
  assert.equal(right2!.row, parent!.row + 1);
});

test("buildTopicGridPlacementById spreads below children horizontally in a row", () => {
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
            tasksCount: 0,
            materialsCount: 0,
            prerequisiteTopicIds: []
          },
          {
            id: "topic-below-1",
            stageId: "stage-a",
            title: "Below 1",
            description: "",
            position: 10,
            status: "not_started",
            progressPercent: 0,
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
  const below1 = placementById.get("topic-below-1");
  const below2 = placementById.get("topic-below-2");

  assert.ok(parent);
  assert.ok(below1);
  assert.ok(below2);

  // Same row, adjacent columns starting from parent column
  assert.equal(below1!.row, parent!.row + 1);
  assert.equal(below2!.row, parent!.row + 1);
  assert.equal(below1!.column, parent!.column);
  assert.equal(below2!.column, parent!.column + 1);
});

test("buildTopicGridPlacementById centers parent among 3 right children", () => {
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
            tasksCount: 0,
            materialsCount: 0,
            prerequisiteTopicIds: []
          },
          {
            id: "topic-r1",
            stageId: "stage-a",
            title: "R1",
            description: "",
            position: 11,
            status: "not_started",
            progressPercent: 0,
            tasksCount: 0,
            materialsCount: 0,
            prerequisiteTopicIds: ["topic-parent"]
          },
          {
            id: "topic-r2",
            stageId: "stage-a",
            title: "R2",
            description: "",
            position: 11,
            status: "not_started",
            progressPercent: 0,
            tasksCount: 0,
            materialsCount: 0,
            prerequisiteTopicIds: ["topic-parent"]
          },
          {
            id: "topic-r3",
            stageId: "stage-a",
            title: "R3",
            description: "",
            position: 11,
            status: "not_started",
            progressPercent: 0,
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
  const r1 = placementById.get("topic-r1");
  const r2 = placementById.get("topic-r2");
  const r3 = placementById.get("topic-r3");

  assert.ok(parent);
  assert.ok(r1);
  assert.ok(r2);
  assert.ok(r3);

  // Parent centered at same row as middle child
  assert.equal(parent!.row, r2!.row);
  assert.equal(r1!.row, parent!.row - 1);
  assert.equal(r3!.row, parent!.row + 1);
  assert.equal(r1!.column, parent!.column + 1);
  assert.equal(r2!.column, parent!.column + 1);
  assert.equal(r3!.column, parent!.column + 1);
});

test("buildTopicGridPlacementById centers parent among 3 left children", () => {
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
            tasksCount: 0,
            materialsCount: 0,
            prerequisiteTopicIds: []
          },
          {
            id: "topic-l1",
            stageId: "stage-a",
            title: "L1",
            description: "",
            position: 9,
            status: "not_started",
            progressPercent: 0,
            tasksCount: 0,
            materialsCount: 0,
            prerequisiteTopicIds: ["topic-parent"]
          },
          {
            id: "topic-l2",
            stageId: "stage-a",
            title: "L2",
            description: "",
            position: 9,
            status: "not_started",
            progressPercent: 0,
            tasksCount: 0,
            materialsCount: 0,
            prerequisiteTopicIds: ["topic-parent"]
          },
          {
            id: "topic-l3",
            stageId: "stage-a",
            title: "L3",
            description: "",
            position: 9,
            status: "not_started",
            progressPercent: 0,
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
  const l1 = placementById.get("topic-l1");
  const l2 = placementById.get("topic-l2");
  const l3 = placementById.get("topic-l3");

  assert.ok(parent);
  assert.ok(l1);
  assert.ok(l2);
  assert.ok(l3);

  // Parent centered at same row as middle child
  assert.equal(parent!.row, l2!.row);
  assert.equal(l1!.row, parent!.row - 1);
  assert.equal(l3!.row, parent!.row + 1);
  assert.equal(l1!.column, parent!.column - 1);
  assert.equal(l2!.column, parent!.column - 1);
  assert.equal(l3!.column, parent!.column - 1);
});

test("buildTopicGridPlacementById separates subtrees of sibling roots", () => {
  const roadmap: RoadmapResponse = {
    stages: [
      {
        id: "stage-a",
        title: "Stage A",
        topics: [
          {
            id: "X",
            stageId: "stage-a",
            title: "X",
            description: "",
            position: 1,
            status: "in_progress",
            progressPercent: 10,
            tasksCount: 0,
            materialsCount: 0,
            prerequisiteTopicIds: []
          },
          {
            id: "Y",
            stageId: "stage-a",
            title: "Y",
            description: "",
            position: 2,
            status: "in_progress",
            progressPercent: 10,
            tasksCount: 0,
            materialsCount: 0,
            prerequisiteTopicIds: []
          },
          {
            id: "x1",
            stageId: "stage-a",
            title: "x1",
            description: "",
            position: 1,
            status: "not_started",
            progressPercent: 0,
            tasksCount: 0,
            materialsCount: 0,
            prerequisiteTopicIds: ["X"]
          },
          {
            id: "x2",
            stageId: "stage-a",
            title: "x2",
            description: "",
            position: 1,
            status: "not_started",
            progressPercent: 0,
            tasksCount: 0,
            materialsCount: 0,
            prerequisiteTopicIds: ["X"]
          },
          {
            id: "x3",
            stageId: "stage-a",
            title: "x3",
            description: "",
            position: 1,
            status: "not_started",
            progressPercent: 0,
            tasksCount: 0,
            materialsCount: 0,
            prerequisiteTopicIds: ["X"]
          },
          {
            id: "y1",
            stageId: "stage-a",
            title: "y1",
            description: "",
            position: 2,
            status: "not_started",
            progressPercent: 0,
            tasksCount: 0,
            materialsCount: 0,
            prerequisiteTopicIds: ["Y"]
          },
          {
            id: "y2",
            stageId: "stage-a",
            title: "y2",
            description: "",
            position: 2,
            status: "not_started",
            progressPercent: 0,
            tasksCount: 0,
            materialsCount: 0,
            prerequisiteTopicIds: ["Y"]
          }
        ]
      }
    ]
  };

  const placementById = buildTopicGridPlacementById(roadmap.stages ?? []);
  const X = placementById.get("X");
  const Y = placementById.get("Y");
  const x1 = placementById.get("x1");
  const x3 = placementById.get("x3");
  const y1 = placementById.get("y1");

  assert.ok(X);
  assert.ok(Y);
  assert.ok(x1);
  assert.ok(x3);
  assert.ok(y1);

  // No collision: all unique positions
  const occupiedKeys = new Set<string>();
  for (const placement of placementById.values()) {
    const key = `${placement.row}:${placement.column}`;
    assert.equal(occupiedKeys.has(key), false, `Collision at ${key}`);
    occupiedKeys.add(key);
  }

  // Subtrees are separated: Y's leftmost column > X's rightmost column
  const xCols = [x1, placementById.get("x2"), x3].map((p) => p!.column);
  const yCols = [y1, placementById.get("y2")].map((p) => p!.column);
  const xMaxCol = Math.max(...xCols);
  const yMinCol = Math.min(...yCols);
  assert.ok(yMinCol > xMaxCol + 1, `Gap between subtrees: xMax=${xMaxCol}, yMin=${yMinCol}`);
});

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const roadmap_layout_1 = require("./roadmap-layout");
function createRoadmapFixture() {
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
function createStageFreeRoadmapFixture() {
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
(0, node_test_1.default)("buildRoadmapConnections builds edge coordinates for prerequisite links", () => {
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
    const connections = (0, roadmap_layout_1.buildRoadmapConnections)(roadmap, { left: 20, top: 10 }, topicRects);
    strict_1.default.deepEqual(connections, [
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
(0, node_test_1.default)("buildRoadmapConnections skips links when source or target topic rect is missing", () => {
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
    const connections = (0, roadmap_layout_1.buildRoadmapConnections)(roadmap, { left: 20, top: 10 }, topicRects);
    strict_1.default.deepEqual(connections, []);
});
(0, node_test_1.default)("buildRoadmapConnections supports stage-free flat topics payload", () => {
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
    const connections = (0, roadmap_layout_1.buildRoadmapConnections)(roadmap, { left: 20, top: 10 }, topicRects);
    strict_1.default.deepEqual(connections, [
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
(0, node_test_1.default)("readGraphSize enforces minimum render size of 1x1", () => {
    const size = (0, roadmap_layout_1.readGraphSize)({
        clientWidth: 0,
        clientHeight: 0,
        scrollWidth: 0,
        scrollHeight: 0
    });
    strict_1.default.deepEqual(size, {
        width: 1,
        height: 1
    });
});
(0, node_test_1.default)("readGraphSize expands to scrollable graph area when content is larger than viewport", () => {
    const size = (0, roadmap_layout_1.readGraphSize)({
        clientWidth: 900,
        clientHeight: 560,
        scrollWidth: 1440,
        scrollHeight: 1280
    });
    strict_1.default.deepEqual(size, {
        width: 1440,
        height: 1280
    });
});
(0, node_test_1.default)("buildTopicGridColumnById spreads topics with duplicate positions into separate columns", () => {
    var _a;
    const roadmap = {
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
    const topicColumns = (0, roadmap_layout_1.buildTopicGridColumnById)((_a = roadmap.stages) !== null && _a !== void 0 ? _a : []);
    strict_1.default.equal(topicColumns.get("topic-a"), 1);
    strict_1.default.equal(topicColumns.get("topic-b"), 2);
    strict_1.default.equal(topicColumns.get("topic-c"), 3);
});
(0, node_test_1.default)("child-topic layout keeps parent and child separate while dependency edge is preserved", () => {
    var _a, _b;
    const roadmap = {
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
    const topicColumns = (0, roadmap_layout_1.buildTopicGridColumnById)((_a = roadmap.stages) !== null && _a !== void 0 ? _a : []);
    const topicPlacement = (0, roadmap_layout_1.buildTopicGridPlacementById)((_b = roadmap.stages) !== null && _b !== void 0 ? _b : []);
    const parentPlacement = topicPlacement.get("topic-parent");
    const childPlacement = topicPlacement.get("topic-child");
    strict_1.default.ok(parentPlacement);
    strict_1.default.ok(childPlacement);
    strict_1.default.ok(childPlacement.row > parentPlacement.row);
    strict_1.default.equal(topicColumns.get("topic-parent"), topicColumns.get("topic-child"));
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
    const connections = (0, roadmap_layout_1.buildRoadmapConnections)(roadmap, { left: 20, top: 10 }, topicRects);
    strict_1.default.deepEqual(connections, [
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
(0, node_test_1.default)("buildRoadmapConnections keeps side anchors for topics on the same row", () => {
    const roadmap = {
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
    const connections = (0, roadmap_layout_1.buildRoadmapConnections)(roadmap, { left: 20, top: 10 }, topicRects);
    strict_1.default.deepEqual(connections, [
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
(0, node_test_1.default)("buildRoadmapConnections keeps enough right-side clearance for visible arrowheads and link handles", () => {
    const roadmap = {
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
    const connections = (0, roadmap_layout_1.buildRoadmapConnections)(roadmap, { left: 20, top: 10 }, topicRects);
    strict_1.default.deepEqual(connections, [
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
(0, node_test_1.default)("buildTopicGridPlacementById keeps directional semantics for left right and below", () => {
    var _a;
    const roadmap = {
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
    const placementById = (0, roadmap_layout_1.buildTopicGridPlacementById)((_a = roadmap.stages) !== null && _a !== void 0 ? _a : []);
    const parent = placementById.get("topic-parent");
    const left = placementById.get("topic-left");
    const right = placementById.get("topic-right");
    const below = placementById.get("topic-below");
    strict_1.default.ok(parent);
    strict_1.default.ok(left);
    strict_1.default.ok(right);
    strict_1.default.ok(below);
    strict_1.default.equal(left.row, parent.row);
    strict_1.default.equal(right.row, parent.row);
    strict_1.default.ok(left.column < parent.column);
    strict_1.default.ok(right.column > parent.column);
    strict_1.default.ok(below.row > parent.row);
});
(0, node_test_1.default)("buildTopicGridPlacementById avoids collisions for sequential directional children", () => {
    var _a;
    const roadmap = {
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
    const placementById = (0, roadmap_layout_1.buildTopicGridPlacementById)((_a = roadmap.stages) !== null && _a !== void 0 ? _a : []);
    const occupiedKeys = new Set();
    for (const placement of placementById.values()) {
        const key = `${placement.row}:${placement.column}`;
        strict_1.default.equal(occupiedKeys.has(key), false);
        occupiedKeys.add(key);
    }
});

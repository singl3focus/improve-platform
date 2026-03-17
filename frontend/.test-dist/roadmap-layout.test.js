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
            x1: 140,
            y1: 110,
            x2: 380,
            y2: 250
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
            x1: 140,
            y1: 110,
            x2: 380,
            y2: 250
        }
    ]);
});
(0, node_test_1.default)("readGraphSize enforces minimum render size of 1x1", () => {
    const size = (0, roadmap_layout_1.readGraphSize)({
        clientWidth: 0,
        clientHeight: 0
    });
    strict_1.default.deepEqual(size, {
        width: 1,
        height: 1
    });
});

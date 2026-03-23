"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const roadmap_graph_1 = require("./roadmap-graph");
(0, node_test_1.default)("parsePositiveInteger returns parsed value for positive integers", () => {
    strict_1.default.equal((0, roadmap_graph_1.parsePositiveInteger)("7", 1), 7);
});
(0, node_test_1.default)("parsePositiveInteger falls back for zero, negative and invalid values", () => {
    strict_1.default.equal((0, roadmap_graph_1.parsePositiveInteger)("0", 5), 5);
    strict_1.default.equal((0, roadmap_graph_1.parsePositiveInteger)("-3", 5), 5);
    strict_1.default.equal((0, roadmap_graph_1.parsePositiveInteger)("abc", 5), 5);
});
(0, node_test_1.default)("buildConnectionPath generates cubic bezier path for top-down graph", () => {
    strict_1.default.equal((0, roadmap_graph_1.buildConnectionPath)(10, 20, 110, 220), "M 10 20 C 10 120, 110 120, 110 220");
});
(0, node_test_1.default)("buildConnectionPath generates cubic bezier path for side-to-side graph", () => {
    strict_1.default.equal((0, roadmap_graph_1.buildConnectionPath)(10, 20, 210, 40), "M 10 20 C 110 20, 110 40, 210 40");
});
(0, node_test_1.default)("getConnectionAnchorSides prefers horizontal anchors when topics are side by side", () => {
    strict_1.default.deepEqual((0, roadmap_graph_1.getConnectionAnchorSides)({ x: 120, y: 90 }, { x: 320, y: 110 }), {
        sourceSide: "right",
        targetSide: "left"
    });
});
(0, node_test_1.default)("getConnectionAnchorSides prefers vertical anchors when topics are stacked", () => {
    strict_1.default.deepEqual((0, roadmap_graph_1.getConnectionAnchorSides)({ x: 120, y: 90 }, { x: 150, y: 280 }), {
        sourceSide: "bottom",
        targetSide: "top"
    });
});
(0, node_test_1.default)("offsetConnectionAnchorPoint moves roadmap arrow anchors away from cards", () => {
    strict_1.default.deepEqual((0, roadmap_graph_1.offsetConnectionAnchorPoint)({ x: 120, y: 90 }, "left", 12), { x: 108, y: 90 });
    strict_1.default.deepEqual((0, roadmap_graph_1.offsetConnectionAnchorPoint)({ x: 120, y: 90 }, "right", 12), { x: 132, y: 90 });
    strict_1.default.deepEqual((0, roadmap_graph_1.offsetConnectionAnchorPoint)({ x: 120, y: 90 }, "top", 12), { x: 120, y: 78 });
});
(0, node_test_1.default)("getConnectionAnchorOffsetDistance reserves extra space on the right side for the link handle", () => {
    strict_1.default.equal((0, roadmap_graph_1.getConnectionAnchorOffsetDistance)("left"), 18);
    strict_1.default.equal((0, roadmap_graph_1.getConnectionAnchorOffsetDistance)("top"), 18);
    strict_1.default.equal((0, roadmap_graph_1.getConnectionAnchorOffsetDistance)("bottom"), 18);
    strict_1.default.equal((0, roadmap_graph_1.getConnectionAnchorOffsetDistance)("right"), 32);
});
(0, node_test_1.default)("normalizeGraphPoint converts client coordinates into graph-relative point", () => {
    const point = (0, roadmap_graph_1.normalizeGraphPoint)(160, 210, { left: 40, top: 120 });
    strict_1.default.deepEqual(point, { x: 120, y: 90 });
});
(0, node_test_1.default)("isDragGesture respects threshold and avoids accidental click drags", () => {
    const start = { x: 10, y: 10 };
    strict_1.default.equal((0, roadmap_graph_1.isDragGesture)(start, { x: 14, y: 14 }, 8), false);
    strict_1.default.equal((0, roadmap_graph_1.isDragGesture)(start, { x: 19, y: 16 }, 8), true);
});
(0, node_test_1.default)("normalizeGraphPoint converts into scene coordinates with transform", () => {
    const point = (0, roadmap_graph_1.normalizeGraphPoint)(250, 190, { left: 50, top: 30 }, {
        scale: 1.5,
        offsetX: 20,
        offsetY: -10
    });
    strict_1.default.deepEqual(point, { x: 120, y: 113.33333333333333 });
});
(0, node_test_1.default)("clampGraphScale keeps value within allowed limits", () => {
    strict_1.default.equal((0, roadmap_graph_1.clampGraphScale)(0.2), 0.6);
    strict_1.default.equal((0, roadmap_graph_1.clampGraphScale)(1.25), 1.25);
    strict_1.default.equal((0, roadmap_graph_1.clampGraphScale)(2.4), 1.8);
});
(0, node_test_1.default)("getGraphOffsetForScale keeps anchor point stable when zooming", () => {
    const nextOffset = (0, roadmap_graph_1.getGraphOffsetForScale)({ x: 300, y: 220 }, {
        scale: 1,
        offsetX: 0,
        offsetY: 0
    }, 1.2);
    strict_1.default.deepEqual(nextOffset, { x: -60, y: -44 });
});
(0, node_test_1.default)("getRoadmapWheelZoomBehavior blocks page scroll and zooms only on desktop", () => {
    strict_1.default.deepEqual((0, roadmap_graph_1.getRoadmapWheelZoomBehavior)(120, 1280, 960), {
        preventPageScroll: true,
        scaleDelta: -0.12
    });
    strict_1.default.deepEqual((0, roadmap_graph_1.getRoadmapWheelZoomBehavior)(-120, 1280, 960), {
        preventPageScroll: true,
        scaleDelta: 0.12
    });
});
(0, node_test_1.default)("getRoadmapWheelZoomBehavior keeps default page scroll on tablet/mobile", () => {
    strict_1.default.deepEqual((0, roadmap_graph_1.getRoadmapWheelZoomBehavior)(120, 960, 960), {
        preventPageScroll: false,
        scaleDelta: 0
    });
    strict_1.default.deepEqual((0, roadmap_graph_1.getRoadmapWheelZoomBehavior)(120, 768, 960), {
        preventPageScroll: false,
        scaleDelta: 0
    });
});
(0, node_test_1.default)("getRoadmapWheelZoomBehavior ignores zero and invalid wheel deltas", () => {
    strict_1.default.deepEqual((0, roadmap_graph_1.getRoadmapWheelZoomBehavior)(0, 1280, 960), {
        preventPageScroll: false,
        scaleDelta: 0
    });
    strict_1.default.deepEqual((0, roadmap_graph_1.getRoadmapWheelZoomBehavior)(Number.NaN, 1280, 960), {
        preventPageScroll: false,
        scaleDelta: 0
    });
});

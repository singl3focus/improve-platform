import test from "node:test";
import assert from "node:assert/strict";
import {
  buildConnectionPath,
  clampGraphScale,
  getConnectionAnchorOffsetDistance,
  getConnectionAnchorSides,
  getGraphOffsetForScale,
  getRoadmapWheelZoomBehavior,
  isDragGesture,
  normalizeGraphPoint,
  offsetConnectionAnchorPoint,
  parsePositiveInteger
} from "./roadmap-graph";

test("parsePositiveInteger returns parsed value for positive integers", () => {
  assert.equal(parsePositiveInteger("7", 1), 7);
});

test("parsePositiveInteger falls back for zero, negative and invalid values", () => {
  assert.equal(parsePositiveInteger("0", 5), 5);
  assert.equal(parsePositiveInteger("-3", 5), 5);
  assert.equal(parsePositiveInteger("abc", 5), 5);
});

test("buildConnectionPath generates cubic bezier path for top-down graph", () => {
  assert.equal(
    buildConnectionPath(10, 20, 110, 220),
    "M 10 20 C 10 120, 110 120, 110 220"
  );
});

test("buildConnectionPath generates cubic bezier path for side-to-side graph", () => {
  assert.equal(
    buildConnectionPath(10, 20, 210, 40),
    "M 10 20 C 110 20, 110 40, 210 40"
  );
});

test("getConnectionAnchorSides prefers horizontal anchors when topics are side by side", () => {
  assert.deepEqual(
    getConnectionAnchorSides({ x: 120, y: 90 }, { x: 320, y: 110 }),
    {
      sourceSide: "right",
      targetSide: "left"
    }
  );
});

test("getConnectionAnchorSides prefers vertical anchors when topics are stacked", () => {
  assert.deepEqual(
    getConnectionAnchorSides({ x: 120, y: 90 }, { x: 150, y: 280 }),
    {
      sourceSide: "bottom",
      targetSide: "top"
    }
  );
});

test("offsetConnectionAnchorPoint moves roadmap arrow anchors away from cards", () => {
  assert.deepEqual(
    offsetConnectionAnchorPoint({ x: 120, y: 90 }, "left", 12),
    { x: 108, y: 90 }
  );
  assert.deepEqual(
    offsetConnectionAnchorPoint({ x: 120, y: 90 }, "right", 12),
    { x: 132, y: 90 }
  );
  assert.deepEqual(
    offsetConnectionAnchorPoint({ x: 120, y: 90 }, "top", 12),
    { x: 120, y: 78 }
  );
});

test("getConnectionAnchorOffsetDistance keeps arrow tips on the card border (no outward gap)", () => {
  assert.equal(getConnectionAnchorOffsetDistance("left"), 0);
  assert.equal(getConnectionAnchorOffsetDistance("top"), 0);
  assert.equal(getConnectionAnchorOffsetDistance("bottom"), 0);
  assert.equal(getConnectionAnchorOffsetDistance("right"), 0);
});

test("normalizeGraphPoint converts client coordinates into graph-relative point", () => {
  const point = normalizeGraphPoint(160, 210, { left: 40, top: 120 } as Pick<
    DOMRect,
    "left" | "top"
  >);

  assert.deepEqual(point, { x: 120, y: 90 });
});

test("isDragGesture respects threshold and avoids accidental click drags", () => {
  const start = { x: 10, y: 10 };

  assert.equal(isDragGesture(start, { x: 14, y: 14 }, 8), false);
  assert.equal(isDragGesture(start, { x: 19, y: 16 }, 8), true);
});

test("normalizeGraphPoint converts into scene coordinates with transform", () => {
  const point = normalizeGraphPoint(
    250,
    190,
    { left: 50, top: 30 } as Pick<DOMRect, "left" | "top">,
    {
      scale: 1.5,
      offsetX: 20,
      offsetY: -10
    }
  );

  assert.deepEqual(point, { x: 120, y: 113.33333333333333 });
});

test("clampGraphScale keeps value within allowed limits", () => {
  assert.equal(clampGraphScale(0.2), 0.6);
  assert.equal(clampGraphScale(1.25), 1.25);
  assert.equal(clampGraphScale(2.4), 1.8);
});

test("getGraphOffsetForScale keeps anchor point stable when zooming", () => {
  const nextOffset = getGraphOffsetForScale(
    { x: 300, y: 220 },
    {
      scale: 1,
      offsetX: 0,
      offsetY: 0
    },
    1.2
  );

  assert.deepEqual(nextOffset, { x: -60, y: -44 });
});

test("getRoadmapWheelZoomBehavior blocks page scroll and zooms only on desktop", () => {
  assert.deepEqual(getRoadmapWheelZoomBehavior(120, 1280, 960), {
    preventPageScroll: true,
    scaleDelta: -0.12
  });

  assert.deepEqual(getRoadmapWheelZoomBehavior(-120, 1280, 960), {
    preventPageScroll: true,
    scaleDelta: 0.12
  });
});

test("getRoadmapWheelZoomBehavior keeps default page scroll on tablet/mobile", () => {
  assert.deepEqual(getRoadmapWheelZoomBehavior(120, 960, 960), {
    preventPageScroll: false,
    scaleDelta: 0
  });

  assert.deepEqual(getRoadmapWheelZoomBehavior(120, 768, 960), {
    preventPageScroll: false,
    scaleDelta: 0
  });
});

test("getRoadmapWheelZoomBehavior ignores zero and invalid wheel deltas", () => {
  assert.deepEqual(getRoadmapWheelZoomBehavior(0, 1280, 960), {
    preventPageScroll: false,
    scaleDelta: 0
  });

  assert.deepEqual(getRoadmapWheelZoomBehavior(Number.NaN, 1280, 960), {
    preventPageScroll: false,
    scaleDelta: 0
  });
});

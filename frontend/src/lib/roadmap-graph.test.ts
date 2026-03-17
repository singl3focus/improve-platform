import test from "node:test";
import assert from "node:assert/strict";
import {
  buildConnectionPath,
  clampGraphScale,
  getGraphOffsetForScale,
  isDragGesture,
  normalizeGraphPoint,
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

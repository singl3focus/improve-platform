import test from "node:test";
import assert from "node:assert/strict";
import {
  computeProgressPercent,
  normalizeProgressPercent,
  parseNonNegativeInteger,
  parsePositiveInteger,
  resolveUnitByType
} from "./materials-form";

test("parsePositiveInteger parses valid numbers and falls back for invalid input", () => {
  assert.equal(parsePositiveInteger("5", 1), 5);
  assert.equal(parsePositiveInteger("0", 1), 1);
  assert.equal(parsePositiveInteger("-2", 1), 1);
  assert.equal(parsePositiveInteger("abc", 1), 1);
});

test("parseNonNegativeInteger parses non-negative values and falls back for invalid input", () => {
  assert.equal(parseNonNegativeInteger("0", 7), 0);
  assert.equal(parseNonNegativeInteger("14", 7), 14);
  assert.equal(parseNonNegativeInteger("-1", 7), 7);
  assert.equal(parseNonNegativeInteger("abc", 7), 7);
});

test("normalizeProgressPercent rounds and clamps progress values", () => {
  assert.equal(normalizeProgressPercent(49.6), 50);
  assert.equal(normalizeProgressPercent(-10), 0);
  assert.equal(normalizeProgressPercent(130), 100);
  assert.equal(normalizeProgressPercent(Number.NaN), 0);
});

test("resolveUnitByType maps supported material types to expected units", () => {
  assert.equal(resolveUnitByType("book"), "pages");
  assert.equal(resolveUnitByType("article"), "pages");
  assert.equal(resolveUnitByType("course"), "lessons");
  assert.equal(resolveUnitByType("video"), "hours");
});

test("computeProgressPercent calculates bounded progress from completed/total amounts", () => {
  assert.equal(computeProgressPercent(200, 40), 20);
  assert.equal(computeProgressPercent(0, 10), 0);
  assert.equal(computeProgressPercent(10, 30), 100);
  assert.equal(computeProgressPercent(10, -3), 0);
});

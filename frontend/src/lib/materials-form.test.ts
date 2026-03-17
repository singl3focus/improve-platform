import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeProgressPercent,
  parsePositiveInteger,
  parseProgressPercent
} from "./materials-form";

test("parsePositiveInteger parses valid numbers and falls back for invalid input", () => {
  assert.equal(parsePositiveInteger("5", 1), 5);
  assert.equal(parsePositiveInteger("0", 1), 1);
  assert.equal(parsePositiveInteger("-2", 1), 1);
  assert.equal(parsePositiveInteger("abc", 1), 1);
});

test("parseProgressPercent keeps values in the 0..100 range", () => {
  assert.equal(parseProgressPercent("0", 50), 0);
  assert.equal(parseProgressPercent("100", 50), 100);
  assert.equal(parseProgressPercent("101", 50), 50);
  assert.equal(parseProgressPercent("-1", 50), 50);
});

test("normalizeProgressPercent rounds and clamps progress values", () => {
  assert.equal(normalizeProgressPercent(49.6), 50);
  assert.equal(normalizeProgressPercent(-10), 0);
  assert.equal(normalizeProgressPercent(130), 100);
  assert.equal(normalizeProgressPercent(Number.NaN), 0);
});

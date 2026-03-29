import test from "node:test";
import assert from "node:assert/strict";
import {
  isRoadmapType,
  prepareRoadmapCreateSubmission
} from "./roadmap-create";

test("prepareRoadmapCreateSubmission trims title and keeps roadmap type", () => {
  const result = prepareRoadmapCreateSubmission({
    title: "  Engineering roadmap  ",
    type: "levels"
  });

  assert.deepEqual(result, {
    ok: true,
    payload: {
      title: "Engineering roadmap",
      type: "levels"
    }
  });
});

test("prepareRoadmapCreateSubmission rejects empty title", () => {
  const result = prepareRoadmapCreateSubmission({
    title: "   ",
    type: "graph"
  });

  assert.deepEqual(result, {
    ok: false,
    error: "title_required"
  });
});

test("isRoadmapType accepts only supported roadmap types", () => {
  assert.equal(isRoadmapType("graph"), true);
  assert.equal(isRoadmapType("levels"), true);
  assert.equal(isRoadmapType("cycles"), true);
  assert.equal(isRoadmapType("cycle"), false);
  assert.equal(isRoadmapType("invalid"), false);
});

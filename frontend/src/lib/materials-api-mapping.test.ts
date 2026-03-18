import test from "node:test";
import assert from "node:assert/strict";
import {
  mapBackendMaterialToLibraryMaterial,
  toBackendCreateMaterialPayload,
  toBackendUpdateMaterialPayload
} from "./materials-api-mapping";
import type { BackendMaterialResponse } from "./backend-learning-contracts";

test("mapBackendMaterialToLibraryMaterial keeps type, unit and amount fields", () => {
  const backendMaterial: BackendMaterialResponse = {
    id: "mat-1",
    topic_id: "topic-1",
    title: "Go by Example",
    description: "Examples and exercises",
    type: "course",
    unit: "lessons",
    total_amount: 24,
    completed_amount: 6,
    progress: 25,
    position: 3,
    updated_at: "2026-03-18T10:00:00Z"
  };

  const mapped = mapBackendMaterialToLibraryMaterial(backendMaterial, "Backend Fundamentals");

  assert.deepEqual(mapped, {
    id: "mat-1",
    topicId: "topic-1",
    topicTitle: "Backend Fundamentals",
    title: "Go by Example",
    description: "Examples and exercises",
    type: "course",
    unit: "lessons",
    totalAmount: 24,
    completedAmount: 6,
    position: 3,
    progressPercent: 25
  });
});

test("toBackendCreateMaterialPayload converts frontend create payload to backend contract", () => {
  const payload = toBackendCreateMaterialPayload({
    topicId: "topic-2",
    title: "System Design",
    description: "Read and summarize",
    type: "article",
    totalAmount: 40,
    completedAmount: 10,
    position: 2
  });

  assert.deepEqual(payload, {
    topic_id: "topic-2",
    title: "System Design",
    description: "Read and summarize",
    type: "article",
    total_amount: 40,
    completed_amount: 10,
    position: 2
  });
});

test("toBackendUpdateMaterialPayload converts frontend update payload to backend contract", () => {
  const payload = toBackendUpdateMaterialPayload({
    title: "Algorithms",
    description: "Revisit dynamic programming",
    type: "book",
    totalAmount: 350,
    completedAmount: 120,
    position: 4
  });

  assert.deepEqual(payload, {
    title: "Algorithms",
    description: "Revisit dynamic programming",
    type: "book",
    total_amount: 350,
    completed_amount: 120,
    position: 4
  });
});

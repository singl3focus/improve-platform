import test from "node:test";
import assert from "node:assert/strict";
import { getBackendApiUrl, sanitizeApiUrl } from "./backend-shared";

test("sanitizeApiUrl keeps default backend URL for empty value", () => {
  assert.equal(sanitizeApiUrl(undefined), "http://localhost:8080");
  assert.equal(sanitizeApiUrl("   "), "http://localhost:8080");
});

test("getBackendApiUrl does not duplicate /api/v1 when BACKEND_API_URL already has it", () => {
  const previous = process.env.BACKEND_API_URL;
  process.env.BACKEND_API_URL = "http://127.0.0.1:8080/api/v1";

  try {
    assert.equal(getBackendApiUrl("/api/v1/roadmap"), "http://127.0.0.1:8080/api/v1/roadmap");
    assert.equal(getBackendApiUrl("api/v1/tasks"), "http://127.0.0.1:8080/api/v1/tasks");
  } finally {
    if (previous === undefined) {
      delete process.env.BACKEND_API_URL;
    } else {
      process.env.BACKEND_API_URL = previous;
    }
  }
});

test("getBackendApiUrl appends path for host-only backend URL", () => {
  const previous = process.env.BACKEND_API_URL;
  process.env.BACKEND_API_URL = "http://127.0.0.1:8080";

  try {
    assert.equal(getBackendApiUrl("/api/v1/roadmap"), "http://127.0.0.1:8080/api/v1/roadmap");
  } finally {
    if (previous === undefined) {
      delete process.env.BACKEND_API_URL;
    } else {
      process.env.BACKEND_API_URL = previous;
    }
  }
});

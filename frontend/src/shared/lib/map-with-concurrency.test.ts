import assert from "node:assert/strict";
import test from "node:test";
import { mapWithConcurrency } from "./map-with-concurrency";

test("mapWithConcurrency preserves input order while running concurrently", async () => {
  const result = await mapWithConcurrency(
    [3, 1, 2],
    async (value) => {
      await new Promise((resolve) => setTimeout(resolve, value * 5));
      return value * 10;
    },
    { concurrency: 3 }
  );

  assert.deepEqual(result, [30, 10, 20]);
});

test("mapWithConcurrency respects concurrency limit", async () => {
  let active = 0;
  let maxActive = 0;

  await mapWithConcurrency(
    [1, 2, 3, 4, 5],
    async (value) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, value));
      active -= 1;
      return value;
    },
    { concurrency: 2 }
  );

  assert.equal(maxActive, 2);
});

test("mapWithConcurrency stops when aborted before work starts", async () => {
  const controller = new AbortController();
  controller.abort(new Error("aborted"));

  await assert.rejects(
    () =>
      mapWithConcurrency(
        [1, 2],
        async (value) => value,
        { concurrency: 2, signal: controller.signal }
      ),
    /aborted/
  );
});

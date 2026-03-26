import test from "node:test";
import assert from "node:assert/strict";
import { getNextTopicPosition } from "./roadmap-topic-position";

test("getNextTopicPosition returns max plus one when roadmap has position gaps", () => {
  const payload = {
    stages: [
      {
        id: "stage-a",
        topics: [
          { id: "topic-a", position: 1 },
          { id: "topic-b", position: 3 },
          { id: "topic-c", position: 8 }
        ]
      }
    ]
  };

  assert.equal(getNextTopicPosition(payload), 9);
});

test("getNextTopicPosition is stable with duplicate and mixed-format positions", () => {
  const payload = {
    roadmap: {
      topics: [
        { id: "topic-a", position: "2" },
        { id: "topic-b", position: 2 },
        { id: "topic-c", position: "4" },
        { id: "topic-d", position: "not-a-number" }
      ]
    }
  };

  assert.equal(getNextTopicPosition(payload), 5);
});
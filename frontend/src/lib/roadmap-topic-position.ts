function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  return value as Record<string, unknown>;
}

function parseFinitePosition(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }

  if (typeof value === "string") {
    const normalized = value.trim();
    if (!normalized) {
      return null;
    }

    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.trunc(parsed));
    }
  }

  return null;
}

function collectRoadmapTopics(roadmapPayload: unknown): Array<Record<string, unknown>> {
  const result: Array<Record<string, unknown>> = [];
  const queue: unknown[] = [roadmapPayload];
  const seen = new Set<Record<string, unknown>>();

  while (queue.length > 0) {
    const next = queue.shift();
    const objectValue = asObject(next);
    if (!objectValue || seen.has(objectValue)) {
      continue;
    }

    seen.add(objectValue);

    const topics = objectValue.topics;
    if (Array.isArray(topics)) {
      for (const topic of topics) {
        const topicObject = asObject(topic);
        if (topicObject) {
          result.push(topicObject);
        }
      }
    }

    const stages = objectValue.stages;
    if (Array.isArray(stages)) {
      for (const stage of stages) {
        const stageObject = asObject(stage);
        if (!stageObject) {
          continue;
        }

        const stageTopics = stageObject.topics;
        if (Array.isArray(stageTopics)) {
          for (const topic of stageTopics) {
            const topicObject = asObject(topic);
            if (topicObject) {
              result.push(topicObject);
            }
          }
        }
      }
    }

    queue.push(objectValue.roadmap, objectValue.data, objectValue.payload);
  }

  return result;
}

export function getNextTopicPosition(roadmapPayload: unknown): number {
  const topics = collectRoadmapTopics(roadmapPayload);
  const maxPosition = topics.reduce((maxValue, topic) => {
    const position = parseFinitePosition(topic.position);
    if (position === null) {
      return maxValue;
    }

    return Math.max(maxValue, position);
  }, 0);

  return maxPosition + 1;
}
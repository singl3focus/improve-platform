export type TopicCreateDirection = "left" | "right" | "below";

export interface TopicCreateDirectionalAnchor {
  parentId: string;
  direction: TopicCreateDirection;
}

export interface TopicCreatePayloadInput {
  title: string;
  description: string;
  position?: number | null;
  anchor?: TopicCreateDirectionalAnchor | null;
}

export interface TopicCreatePayload {
  title: string;
  description: string;
  position?: number;
  direction?: TopicCreateDirection;
  relative_to_topic_id?: string;
}

export interface DirectionalDependencyPlanInput {
  roadmapPayload: unknown;
  parentTopicId: string;
  createdTopicId: string;
}

export interface DirectionalDependencyPlan {
  shouldAddParentDependsOnCreated: boolean;
  shouldRemoveCreatedDependsOnParent: boolean;
}

interface TopicDependenciesSnapshot {
  id: string;
  dependencies: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function readDependencyIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const unique = new Set<string>();
  for (const candidate of value) {
    if (typeof candidate !== "string") {
      continue;
    }

    const normalized = candidate.trim();
    if (!normalized) {
      continue;
    }

    unique.add(normalized);
  }

  return Array.from(unique.values());
}

function toTopicSnapshot(candidate: unknown): TopicDependenciesSnapshot | null {
  if (!isRecord(candidate) || typeof candidate.id !== "string") {
    return null;
  }

  const topicId = candidate.id.trim();
  if (!topicId) {
    return null;
  }

  return {
    id: topicId,
    dependencies: readDependencyIds(candidate.dependencies ?? candidate.prerequisiteTopicIds)
  };
}

function collectTopicSnapshots(roadmapPayload: unknown): TopicDependenciesSnapshot[] {
  if (!isRecord(roadmapPayload)) {
    return [];
  }

  const snapshotsById = new Map<string, TopicDependenciesSnapshot>();

  if (Array.isArray(roadmapPayload.topics)) {
    for (const topic of roadmapPayload.topics) {
      const snapshot = toTopicSnapshot(topic);
      if (!snapshot) {
        continue;
      }

      snapshotsById.set(snapshot.id, snapshot);
    }
  }

  if (Array.isArray(roadmapPayload.stages)) {
    for (const stage of roadmapPayload.stages) {
      if (!isRecord(stage) || !Array.isArray(stage.topics)) {
        continue;
      }

      for (const topic of stage.topics) {
        const snapshot = toTopicSnapshot(topic);
        if (!snapshot) {
          continue;
        }

        snapshotsById.set(snapshot.id, snapshot);
      }
    }
  }

  return Array.from(snapshotsById.values());
}

export function buildDirectionalDependencyPlan(
  input: DirectionalDependencyPlanInput
): DirectionalDependencyPlan {
  const snapshots = collectTopicSnapshots(input.roadmapPayload);
  const dependenciesByTopicId = new Map<string, Set<string>>();

  for (const snapshot of snapshots) {
    dependenciesByTopicId.set(snapshot.id, new Set(snapshot.dependencies));
  }

  const parentDependencies = dependenciesByTopicId.get(input.parentTopicId) ?? new Set<string>();
  const createdDependencies =
    dependenciesByTopicId.get(input.createdTopicId) ?? new Set<string>();

  return {
    shouldAddParentDependsOnCreated: !parentDependencies.has(input.createdTopicId),
    shouldRemoveCreatedDependsOnParent: createdDependencies.has(input.parentTopicId)
  };
}

export function buildTopicCreatePayload(input: TopicCreatePayloadInput): TopicCreatePayload {
  const payload: TopicCreatePayload = {
    title: input.title,
    description: input.description
  };

  if (input.anchor) {
    payload.direction = input.anchor.direction;
    payload.relative_to_topic_id = input.anchor.parentId;
    return payload;
  }

  if (
    typeof input.position === "number" &&
    Number.isFinite(input.position) &&
    input.position >= 1
  ) {
    payload.position = Math.trunc(input.position);
  }

  return payload;
}

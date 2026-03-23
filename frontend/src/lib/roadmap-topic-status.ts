import type { RoadmapTopicStatus } from "./roadmap-types";

const ROADMAP_TOPIC_STATUSES: RoadmapTopicStatus[] = [
  "not_started",
  "in_progress",
  "paused",
  "completed"
];

const ROADMAP_TOPIC_STATUS_TRANSITIONS: Record<RoadmapTopicStatus, readonly RoadmapTopicStatus[]> = {
  not_started: ["in_progress"],
  in_progress: ["paused", "completed"],
  paused: ["in_progress", "not_started"],
  completed: ["in_progress"]
};

export type RoadmapTopicStatusChangeValidationResult =
  | { ok: true }
  | {
      ok: false;
      reason: "invalid_transition";
      allowedStatuses: RoadmapTopicStatus[];
    }
  | {
      ok: false;
      reason: "blocked";
    };

export function isRoadmapTopicStatus(value: string): value is RoadmapTopicStatus {
  return ROADMAP_TOPIC_STATUSES.includes(value as RoadmapTopicStatus);
}

export function getRoadmapTopicStatuses(): RoadmapTopicStatus[] {
  return [...ROADMAP_TOPIC_STATUSES];
}

export function getAllowedRoadmapTopicStatuses(
  currentStatus: RoadmapTopicStatus
): RoadmapTopicStatus[] {
  return [...ROADMAP_TOPIC_STATUS_TRANSITIONS[currentStatus]];
}

export function validateRoadmapTopicStatusChange(input: {
  currentStatus: RoadmapTopicStatus;
  nextStatus: RoadmapTopicStatus;
  isBlocked: boolean;
}): RoadmapTopicStatusChangeValidationResult {
  if (input.currentStatus === input.nextStatus) {
    return { ok: true };
  }

  const allowedStatuses = getAllowedRoadmapTopicStatuses(input.currentStatus);
  if (!allowedStatuses.includes(input.nextStatus)) {
    return {
      ok: false,
      reason: "invalid_transition",
      allowedStatuses
    };
  }

  if (
    input.isBlocked &&
    (input.nextStatus === "in_progress" || input.nextStatus === "completed")
  ) {
    return {
      ok: false,
      reason: "blocked"
    };
  }

  return { ok: true };
}

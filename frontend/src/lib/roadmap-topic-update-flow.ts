import {
  getAllowedRoadmapTopicStatuses,
  validateRoadmapTopicStatusChange
} from "./roadmap-topic-status";
import type { RoadmapTopicStatus } from "./roadmap-types";

export interface RoadmapTopicCurrentState {
  status: RoadmapTopicStatus;
  isBlocked: boolean;
  blockedReason: string | null;
  position: number;
  startDate: string | null;
  targetDate: string | null;
}

export interface RoadmapTopicUpdateRequest {
  title: string;
  description: string;
  status: RoadmapTopicStatus | null;
}

export type RoadmapTopicUpdatePlan =
  | {
      ok: true;
      responseStatus: RoadmapTopicStatus;
      statusPayload: {
        status: RoadmapTopicStatus;
      } | null;
      topicPayload: {
        title: string;
        description: string;
        position: number;
        start_date: string | null;
        target_date: string | null;
      };
    }
  | {
      ok: false;
      httpStatus: 400 | 409;
      code: "invalid_status" | "topic_blocked";
      message: string;
    };

export function buildRoadmapTopicUpdatePlan(input: {
  currentTopic: RoadmapTopicCurrentState;
  request: RoadmapTopicUpdateRequest;
}): RoadmapTopicUpdatePlan {
  const { currentTopic, request } = input;

  if (request.status) {
    const statusValidation = validateRoadmapTopicStatusChange({
      currentStatus: currentTopic.status,
      nextStatus: request.status,
      isBlocked: currentTopic.isBlocked
    });

    if (!statusValidation.ok) {
      if (statusValidation.reason === "blocked") {
        return {
          ok: false,
          httpStatus: 409,
          code: "topic_blocked",
          message: `Blocked topic cannot be moved manually to "${request.status}" until prerequisites are completed.${
            currentTopic.blockedReason ? ` Reason: ${currentTopic.blockedReason}` : ""
          }`
        };
      }

      return {
        ok: false,
        httpStatus: 400,
        code: "invalid_status",
        message: `Invalid topic status transition from "${currentTopic.status}" to "${request.status}". Allowed: ${getAllowedRoadmapTopicStatuses(
          currentTopic.status
        ).join(", ")}.`
      };
    }
  }

  return {
    ok: true,
    responseStatus: request.status ?? currentTopic.status,
    statusPayload:
      request.status && request.status !== currentTopic.status
        ? {
            status: request.status
          }
        : null,
    topicPayload: {
      title: request.title,
      description: request.description,
      position: currentTopic.position,
      start_date: currentTopic.startDate,
      target_date: currentTopic.targetDate
    }
  };
}

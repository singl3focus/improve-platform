import {
  getAllowedRoadmapTopicStatuses,
  validateRoadmapTopicStatusChange
} from "./roadmap-topic-status";
import type { RoadmapTopicStatus } from "../types";

export interface RoadmapTopicCurrentState {
  status: RoadmapTopicStatus;
  position: number;
  startDate: string | null;
  targetDate: string | null;
}

export interface RoadmapTopicUpdateRequest {
  title: string;
  description: string;
  status: RoadmapTopicStatus | null;
  startDate?: string | null;
  targetDate?: string | null;
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
      httpStatus: 400;
      code: "invalid_status";
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
      nextStatus: request.status
    });

    if (!statusValidation.ok) {
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
      start_date: request.startDate !== undefined ? request.startDate : currentTopic.startDate,
      target_date: request.targetDate !== undefined ? request.targetDate : currentTopic.targetDate
    }
  };
}

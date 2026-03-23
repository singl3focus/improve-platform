import {
  validateRoadmapTopicStatusChange,
  type RoadmapTopicStatusChangeValidationResult
} from "./roadmap-topic-status";
import type { RoadmapTopic, RoadmapTopicStatus } from "./roadmap-types";

export interface RoadmapTopicEditDraftValues {
  title: string;
  description: string;
  status: RoadmapTopicStatus;
}

export type RoadmapTopicEditSubmissionResult =
  | {
      ok: true;
      payload: {
        title: string;
        description: string;
        status: RoadmapTopicStatus;
      };
      statusChanged: boolean;
    }
  | {
      ok: false;
      reason: "title_required";
    }
  | {
      ok: false;
      reason: "invalid_transition" | "blocked";
      validationResult: Extract<
        RoadmapTopicStatusChangeValidationResult,
        {
          ok: false;
        }
      >;
    };

export function prepareRoadmapTopicEditSubmission(input: {
  topic: Pick<RoadmapTopic, "status" | "isBlocked">;
  draft: RoadmapTopicEditDraftValues;
}): RoadmapTopicEditSubmissionResult {
  const title = input.draft.title.trim();
  if (!title) {
    return {
      ok: false,
      reason: "title_required"
    };
  }

  const validationResult = validateRoadmapTopicStatusChange({
    currentStatus: input.topic.status,
    nextStatus: input.draft.status,
    isBlocked: input.topic.isBlocked
  });
  if (!validationResult.ok) {
    return {
      ok: false,
      reason: validationResult.reason,
      validationResult
    };
  }

  return {
    ok: true,
    payload: {
      title,
      description: input.draft.description.trim(),
      status: input.draft.status
    },
    statusChanged: input.topic.status !== input.draft.status
  };
}

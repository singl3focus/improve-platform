import type { RoadmapTopicStatus } from "../types";
import { isRoadmapTopicStatus } from "./roadmap-topic-status";
import { normalizeText } from "../../../shared/api/payload-parsers";

interface RawRoadmapTopicUpdatePayload {
  title?: unknown;
  description?: unknown;
  status?: unknown;
  start_date?: unknown;
  target_date?: unknown;
}

interface CurrentRoadmapTopicSnapshot {
  title: string;
  description: string;
  status: RoadmapTopicStatus;
}

type RoadmapTopicUpdateRequestResult =
  | {
      ok: true;
      value: {
        title: string;
        description: string;
        status: RoadmapTopicStatus | null;
        startDate: string | null | undefined;
        targetDate: string | null | undefined;
      };
    }
  | {
      ok: false;
      message: string;
    };

function normalizeNullableDateInput(
  value: unknown
): string | null | undefined | typeof INVALID_DATE_INPUT {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    return INVALID_DATE_INPUT;
  }
  return value.trim() || null;
}

const INVALID_DATE_INPUT = Symbol("invalid-date-input");

export function resolveRoadmapTopicUpdateRequest(
  currentTopic: CurrentRoadmapTopicSnapshot,
  payload: RawRoadmapTopicUpdatePayload
): RoadmapTopicUpdateRequestResult {
  const title =
    payload.title === undefined ? currentTopic.title : normalizeText(payload.title);
  if (!title) {
    return {
      ok: false,
      message: "Title is required."
    };
  }

  if (payload.description !== undefined && typeof payload.description !== "string") {
    return {
      ok: false,
      message: "Description must be a string."
    };
  }

  if (
    payload.status !== undefined &&
    (typeof payload.status !== "string" || !isRoadmapTopicStatus(payload.status))
  ) {
    return {
      ok: false,
      message: "Invalid topic status. Allowed: not_started, in_progress, paused, completed."
    };
  }

  const startDate = normalizeNullableDateInput(payload.start_date);
  if (startDate === INVALID_DATE_INPUT) {
    return {
      ok: false,
      message: "Start date must be a string or null."
    };
  }

  const targetDate = normalizeNullableDateInput(payload.target_date);
  if (targetDate === INVALID_DATE_INPUT) {
    return {
      ok: false,
      message: "Target date must be a string or null."
    };
  }

  return {
    ok: true,
    value: {
      title,
      description:
        payload.description === undefined ? currentTopic.description : payload.description.trim(),
      status: typeof payload.status === "string" ? payload.status : null,
      startDate,
      targetDate
    }
  };
}

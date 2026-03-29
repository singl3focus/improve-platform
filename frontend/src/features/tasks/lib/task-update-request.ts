import type { BackendTaskResponse } from "../../../shared/api/backend-contracts";
import { normalizeText } from "../../../shared/api/payload-parsers";

interface TaskUpdateRequestPayload {
  title?: unknown;
  description?: unknown;
  topicId?: unknown;
  deadline?: unknown;
}

type TaskUpdateRequestResult =
  | {
      ok: true;
      value: {
        title: string;
        description: string;
        topicId: string | null;
        deadline: string | null;
      };
    }
  | {
      ok: false;
      message: string;
    };

export function resolveTaskUpdateRequest(
  currentTask: BackendTaskResponse,
  payload: TaskUpdateRequestPayload
): TaskUpdateRequestResult {
  const title =
    payload.title === undefined ? currentTask.title : normalizeText(payload.title);
  if (!title) {
    return {
      ok: false,
      message: "Title must be a non-empty string."
    };
  }

  if (payload.description !== undefined && typeof payload.description !== "string") {
    return {
      ok: false,
      message: "Description must be a string."
    };
  }

  if (
    payload.topicId !== undefined &&
    payload.topicId !== null &&
    typeof payload.topicId !== "string"
  ) {
    return {
      ok: false,
      message: "Topic id must be a string."
    };
  }

  if (
    payload.deadline !== undefined &&
    payload.deadline !== null &&
    typeof payload.deadline !== "string"
  ) {
    return {
      ok: false,
      message: "Deadline must be a string."
    };
  }

  return {
    ok: true,
    value: {
      title,
      description:
        payload.description === undefined ? currentTask.description : payload.description.trim(),
      topicId:
        payload.topicId === undefined
          ? currentTask.topic_id
          : normalizeText(payload.topicId) ?? null,
      deadline:
        payload.deadline === undefined
          ? currentTask.deadline
          : normalizeText(payload.deadline) ?? null
    }
  };
}

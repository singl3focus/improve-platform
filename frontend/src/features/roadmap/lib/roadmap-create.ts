import type { RoadmapType } from "../types";

export interface RoadmapCreateDraft {
  title: string;
  type: RoadmapType;
}

export type RoadmapCreateSubmissionResult =
  | {
      ok: true;
      payload: {
        title: string;
        type: RoadmapType;
      };
    }
  | {
      ok: false;
      error: "title_required";
    };

export const ROADMAP_TYPES: RoadmapType[] = ["graph", "levels", "cycles"];

export function isRoadmapType(value: string): value is RoadmapType {
  return ROADMAP_TYPES.includes(value as RoadmapType);
}

export function prepareRoadmapCreateSubmission(
  draft: RoadmapCreateDraft
): RoadmapCreateSubmissionResult {
  const title = draft.title.trim();
  if (!title) {
    return {
      ok: false,
      error: "title_required"
    };
  }

  return {
    ok: true,
    payload: {
      title,
      type: draft.type
    }
  };
}

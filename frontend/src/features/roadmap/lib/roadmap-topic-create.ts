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

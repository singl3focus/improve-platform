import {
  flattenRoadmapTopics,
  type RoadmapResponse,
  type RoadmapStage,
  type RoadmapTopic
} from "../types";
import {
  getConnectionAnchorOffsetDistance,
  getConnectionAnchorSides,
  offsetConnectionAnchorPoint,
  type GraphSize,
  type RoadmapConnection
} from "./roadmap-graph";

export interface TopicRectLike {
  left: number;
  top: number;
  width: number;
  bottom: number;
}

export interface TopicGridPlacement {
  row: number;
  column: number;
}

export function compareTopicsByPosition(leftTopic: RoadmapTopic, rightTopic: RoadmapTopic): number {
  if (leftTopic.position !== rightTopic.position) {
    return leftTopic.position - rightTopic.position;
  }

  return leftTopic.id.localeCompare(rightTopic.id);
}

export function buildTopicGridColumnById(
  stages: ReadonlyArray<Pick<RoadmapStage, "topics">>
): Map<string, number> {
  const placementById = buildTopicGridPlacementById(stages);
  const map = new Map<string, number>();

  for (const [topicId, placement] of placementById.entries()) {
    map.set(topicId, placement.column);
  }

  return map;
}

function buildTopicGridKey(row: number, column: number): string {
  return `${row}:${column}`;
}

function classifyDirection(parent: RoadmapTopic, child: RoadmapTopic): "left" | "right" | "below" {
  if (child.position < parent.position) {
    return "left";
  }
  if (child.position > parent.position) {
    return "right";
  }
  return "below";
}

function getTopicRectCenter(rect: TopicRectLike): { x: number; y: number } {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + (rect.bottom - rect.top) / 2
  };
}

function getTopicRectAnchorPoint(
  rect: TopicRectLike,
  side: "left" | "right" | "top" | "bottom",
  containerRect: Pick<TopicRectLike, "left" | "top">
) {
  if (side === "left") {
    return {
      x: rect.left - containerRect.left,
      y: rect.top + (rect.bottom - rect.top) / 2 - containerRect.top
    };
  }

  if (side === "right") {
    return {
      x: rect.left + rect.width - containerRect.left,
      y: rect.top + (rect.bottom - rect.top) / 2 - containerRect.top
    };
  }

  if (side === "top") {
    return {
      x: rect.left + rect.width / 2 - containerRect.left,
      y: rect.top - containerRect.top
    };
  }

  return {
    x: rect.left + rect.width / 2 - containerRect.left,
    y: rect.bottom - containerRect.top
  };
}

export function buildTopicGridPlacementById(
  stages: ReadonlyArray<Pick<RoadmapStage, "topics">>
): Map<string, TopicGridPlacement> {
  const topics = stages
    .flatMap((stage) => stage.topics)
    .slice()
    .sort(compareTopicsByPosition);
  const topicById = new Map(topics.map((topic) => [topic.id, topic]));
  const childIdsByParentId = new Map<string, string[]>();

  for (const topic of topics) {
    const parentIds = topic.prerequisiteTopicIds.slice().sort();
    for (const parentId of parentIds) {
      if (!topicById.has(parentId)) {
        continue;
      }

      const childIds = childIdsByParentId.get(parentId) ?? [];
      childIds.push(topic.id);
      childIdsByParentId.set(parentId, childIds);
    }
  }

  for (const childIds of childIdsByParentId.values()) {
    childIds.sort((leftId, rightId) => {
      const leftTopic = topicById.get(leftId);
      const rightTopic = topicById.get(rightId);
      if (!leftTopic || !rightTopic) {
        return leftId.localeCompare(rightId);
      }

      return compareTopicsByPosition(leftTopic, rightTopic);
    });
  }

  const placementById = new Map<string, TopicGridPlacement>();
  const occupied = new Set<string>();

  const occupy = (topicId: string, row: number, column: number) => {
    placementById.set(topicId, { row, column });
    occupied.add(buildTopicGridKey(row, column));
  };

  const placeWithDirection = (
    topicId: string,
    row: number,
    column: number,
    direction: "left" | "right" | "below"
  ) => {
    let nextRow = row;
    let nextColumn = column;

    while (occupied.has(buildTopicGridKey(nextRow, nextColumn))) {
      if (direction === "left") {
        nextColumn -= 1;
      } else if (direction === "right") {
        nextColumn += 1;
      } else {
        nextRow += 1;
      }
    }

    occupy(topicId, nextRow, nextColumn);
  };

  const placeChildren = (parentId: string) => {
    const parentPlacement = placementById.get(parentId);
    const parentTopic = topicById.get(parentId);
    if (!parentPlacement || !parentTopic) {
      return;
    }

    const children = (childIdsByParentId.get(parentId) ?? [])
      .map((childId) => topicById.get(childId))
      .filter((topic): topic is RoadmapTopic => Boolean(topic));

    const leftChildren = children.filter((child) => classifyDirection(parentTopic, child) === "left");
    const rightChildren = children.filter((child) => classifyDirection(parentTopic, child) === "right");
    const belowChildren = children.filter((child) => classifyDirection(parentTopic, child) === "below");

    for (const child of leftChildren) {
      if (placementById.has(child.id)) {
        continue;
      }

      placeWithDirection(child.id, parentPlacement.row, parentPlacement.column - 1, "left");
      placeChildren(child.id);
    }

    for (const child of rightChildren) {
      if (placementById.has(child.id)) {
        continue;
      }

      placeWithDirection(child.id, parentPlacement.row, parentPlacement.column + 1, "right");
      placeChildren(child.id);
    }

    for (const child of belowChildren) {
      if (placementById.has(child.id)) {
        continue;
      }

      placeWithDirection(child.id, parentPlacement.row + 1, parentPlacement.column, "below");
      placeChildren(child.id);
    }
  };

  const rootTopics = topics.filter((topic) => topic.prerequisiteTopicIds.length === 0);
  let rootColumn = 1;
  for (const topic of rootTopics) {
    if (placementById.has(topic.id)) {
      continue;
    }

    while (occupied.has(buildTopicGridKey(1, rootColumn))) {
      rootColumn += 1;
    }

    occupy(topic.id, 1, rootColumn);
    rootColumn += 1;
    placeChildren(topic.id);
  }

  let fallbackRow =
    Math.max(1, ...Array.from(placementById.values()).map((placement) => placement.row)) + 1;
  for (const topic of topics) {
    if (placementById.has(topic.id)) {
      continue;
    }

    let fallbackColumn = 1;
    while (occupied.has(buildTopicGridKey(fallbackRow, fallbackColumn))) {
      fallbackColumn += 1;
    }

    occupy(topic.id, fallbackRow, fallbackColumn);
    fallbackRow += 1;
    placeChildren(topic.id);
  }

  const minimumColumn = Math.min(
    ...Array.from(placementById.values()).map((placement) => placement.column)
  );
  if (minimumColumn < 1) {
    const offset = 1 - minimumColumn;
    for (const [topicId, placement] of placementById.entries()) {
      placementById.set(topicId, {
        row: placement.row,
        column: placement.column + offset
      });
    }
  }

  return placementById;
}

export function buildRoadmapConnections(
  roadmap: RoadmapResponse,
  containerRect: Pick<TopicRectLike, "left" | "top">,
  topicRects: ReadonlyMap<string, TopicRectLike>
): RoadmapConnection[] {
  const connections: RoadmapConnection[] = [];

  for (const topic of flattenRoadmapTopics(roadmap)) {
    const toRect = topicRects.get(topic.id);
    if (!toRect) {
      continue;
    }

    for (const prerequisiteTopicId of topic.prerequisiteTopicIds) {
      const fromRect = topicRects.get(prerequisiteTopicId);
      if (!fromRect) {
        continue;
      }

      const anchorSides = getConnectionAnchorSides(
        getTopicRectCenter(fromRect),
        getTopicRectCenter(toRect)
      );
      const sourcePoint = offsetConnectionAnchorPoint(
        getTopicRectAnchorPoint(fromRect, anchorSides.sourceSide, containerRect),
        anchorSides.sourceSide,
        getConnectionAnchorOffsetDistance(anchorSides.sourceSide)
      );
      const targetPoint = offsetConnectionAnchorPoint(
        getTopicRectAnchorPoint(toRect, anchorSides.targetSide, containerRect),
        anchorSides.targetSide,
        getConnectionAnchorOffsetDistance(anchorSides.targetSide)
      );

      connections.push({
        fromId: prerequisiteTopicId,
        toId: topic.id,
        x1: sourcePoint.x,
        y1: sourcePoint.y,
        x2: targetPoint.x,
        y2: targetPoint.y
      });
    }
  }

  return connections;
}

export function readGraphSize(
  element: Pick<HTMLElement, "clientWidth" | "clientHeight"> & {
    scrollWidth?: number;
    scrollHeight?: number;
  }
): GraphSize {
  return {
    width: Math.max(element.clientWidth, element.scrollWidth ?? 0, 1),
    height: Math.max(element.clientHeight, element.scrollHeight ?? 0, 1)
  };
}

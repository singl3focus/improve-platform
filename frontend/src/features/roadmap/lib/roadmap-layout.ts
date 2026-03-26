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

interface LayoutNode {
  topicId: string;
  leftChildren: LayoutNode[];
  rightChildren: LayoutNode[];
  belowChildren: LayoutNode[];
  extent: SubtreeExtent;
}

interface SubtreeExtent {
  leftCols: number;
  rightCols: number;
  upRows: number;
  downRows: number;
}

const SUBTREE_GAP = 1;

function buildLayoutForest(
  topics: RoadmapTopic[],
  topicById: Map<string, RoadmapTopic>,
  childIdsByParentId: Map<string, string[]>
): { roots: LayoutNode[]; orphanIds: string[] } {
  const claimed = new Set<string>();

  function buildNode(topicId: string): LayoutNode | null {
    if (claimed.has(topicId)) {
      return null;
    }

    const topic = topicById.get(topicId);
    if (!topic) {
      return null;
    }

    claimed.add(topicId);

    const childIds = childIdsByParentId.get(topicId) ?? [];
    const leftChildren: LayoutNode[] = [];
    const rightChildren: LayoutNode[] = [];
    const belowChildren: LayoutNode[] = [];

    for (const childId of childIds) {
      const child = topicById.get(childId);
      if (!child) {
        continue;
      }

      const direction = classifyDirection(topic, child);
      const childNode = buildNode(childId);
      if (!childNode) {
        continue;
      }

      if (direction === "left") {
        leftChildren.push(childNode);
      } else if (direction === "right") {
        rightChildren.push(childNode);
      } else {
        belowChildren.push(childNode);
      }
    }

    return {
      topicId,
      leftChildren,
      rightChildren,
      belowChildren,
      extent: { leftCols: 0, rightCols: 0, upRows: 0, downRows: 0 }
    };
  }

  const rootTopics = topics.filter((topic) => topic.prerequisiteTopicIds.length === 0);
  const roots: LayoutNode[] = [];
  for (const topic of rootTopics) {
    const node = buildNode(topic.id);
    if (node) {
      roots.push(node);
    }
  }

  const orphanIds: string[] = [];
  for (const topic of topics) {
    if (!claimed.has(topic.id)) {
      const node = buildNode(topic.id);
      if (node) {
        roots.push(node);
      } else {
        orphanIds.push(topic.id);
      }
    }
  }

  return { roots, orphanIds };
}

function computeSubtreeExtent(node: LayoutNode): void {
  for (const child of node.leftChildren) {
    computeSubtreeExtent(child);
  }
  for (const child of node.rightChildren) {
    computeSubtreeExtent(child);
  }
  for (const child of node.belowChildren) {
    computeSubtreeExtent(child);
  }

  const leftRowSpan = node.leftChildren.reduce(
    (sum, child) => sum + child.extent.upRows + 1 + child.extent.downRows,
    0
  );
  const rightRowSpan = node.rightChildren.reduce(
    (sum, child) => sum + child.extent.upRows + 1 + child.extent.downRows,
    0
  );

  const maxSideRowSpan = Math.max(leftRowSpan, rightRowSpan, 1);
  const centerOffset = Math.floor((maxSideRowSpan - 1) / 2);

  let leftColsFromLeft = 0;
  if (node.leftChildren.length > 0) {
    const childRightOverlap = Math.max(...node.leftChildren.map((c) => c.extent.rightCols));
    const gap = 1 + childRightOverlap;
    const childLeftExtension = Math.max(...node.leftChildren.map((c) => c.extent.leftCols));
    leftColsFromLeft = gap + childLeftExtension;
  }

  let rightColsFromRight = 0;
  if (node.rightChildren.length > 0) {
    const childLeftOverlap = Math.max(...node.rightChildren.map((c) => c.extent.leftCols));
    const gap = 1 + childLeftOverlap;
    const childRightExtension = Math.max(...node.rightChildren.map((c) => c.extent.rightCols));
    rightColsFromRight = gap + childRightExtension;
  }

  let belowColSpan = 0;
  let belowDownExtension = 0;
  let belowUpExtension = 0;
  if (node.belowChildren.length > 0) {
    belowColSpan = node.belowChildren.reduce(
      (sum, child) => sum + child.extent.leftCols + 1 + child.extent.rightCols,
      0
    );
    belowDownExtension = Math.max(...node.belowChildren.map((c) => c.extent.downRows));
    belowUpExtension = Math.max(...node.belowChildren.map((c) => c.extent.upRows));
  }

  const sideDownSpan = maxSideRowSpan - 1 - centerOffset;
  const belowRowOffset = node.belowChildren.length > 0
    ? Math.max(1, sideDownSpan + 1) + belowUpExtension
    : 0;

  const leftCols = Math.max(leftColsFromLeft, 0);
  const rightCols = Math.max(
    rightColsFromRight,
    belowColSpan > 0 ? belowColSpan - 1 : 0
  );

  const upRows = centerOffset;
  const downRows = Math.max(
    sideDownSpan,
    belowRowOffset > 0 ? belowRowOffset + belowDownExtension : 0
  );

  node.extent = { leftCols, rightCols, upRows, downRows };
}

function placeSubtree(
  node: LayoutNode,
  nodeRow: number,
  nodeCol: number,
  placementById: Map<string, TopicGridPlacement>
): void {
  placementById.set(node.topicId, { row: nodeRow, column: nodeCol });

  if (node.leftChildren.length > 0) {
    const leftRowSpan = node.leftChildren.reduce(
      (sum, child) => sum + child.extent.upRows + 1 + child.extent.downRows,
      0
    );
    const startRow = nodeRow - Math.floor((leftRowSpan - 1) / 2);
    const childRightOverlap = Math.max(...node.leftChildren.map((c) => c.extent.rightCols));
    const childCol = nodeCol - 1 - childRightOverlap;

    let cursor = startRow;
    for (const child of node.leftChildren) {
      const childRow = cursor + child.extent.upRows;
      placeSubtree(child, childRow, childCol, placementById);
      cursor += child.extent.upRows + 1 + child.extent.downRows;
    }
  }

  if (node.rightChildren.length > 0) {
    const rightRowSpan = node.rightChildren.reduce(
      (sum, child) => sum + child.extent.upRows + 1 + child.extent.downRows,
      0
    );
    const startRow = nodeRow - Math.floor((rightRowSpan - 1) / 2);
    const childLeftOverlap = Math.max(...node.rightChildren.map((c) => c.extent.leftCols));
    const childCol = nodeCol + 1 + childLeftOverlap;

    let cursor = startRow;
    for (const child of node.rightChildren) {
      const childRow = cursor + child.extent.upRows;
      placeSubtree(child, childRow, childCol, placementById);
      cursor += child.extent.upRows + 1 + child.extent.downRows;
    }
  }

  if (node.belowChildren.length > 0) {
    const leftRowSpanForBelow = node.leftChildren.reduce(
      (sum, child) => sum + child.extent.upRows + 1 + child.extent.downRows,
      0
    );
    const rightRowSpanForBelow = node.rightChildren.reduce(
      (sum, child) => sum + child.extent.upRows + 1 + child.extent.downRows,
      0
    );
    const maxSideForBelow = Math.max(leftRowSpanForBelow, rightRowSpanForBelow, 1);
    const centerOffsetForBelow = Math.floor((maxSideForBelow - 1) / 2);
    const sideDown = maxSideForBelow - 1 - centerOffsetForBelow;

    const belowUpExtension = Math.max(...node.belowChildren.map((c) => c.extent.upRows));
    const belowRow = nodeRow + Math.max(1, sideDown + 1) + belowUpExtension;

    let cursor = nodeCol;
    for (const child of node.belowChildren) {
      const childCol = cursor + child.extent.leftCols;
      placeSubtree(child, belowRow, childCol, placementById);
      cursor += child.extent.leftCols + 1 + child.extent.rightCols;
    }
  }
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

  const { roots, orphanIds } = buildLayoutForest(topics, topicById, childIdsByParentId);

  for (const root of roots) {
    computeSubtreeExtent(root);
  }

  const placementById = new Map<string, TopicGridPlacement>();
  let nextCol = 1;

  for (const root of roots) {
    const rootCol = nextCol + root.extent.leftCols;
    const rootRow = 1 + root.extent.upRows;
    placeSubtree(root, rootRow, rootCol, placementById);
    nextCol = rootCol + root.extent.rightCols + 1 + SUBTREE_GAP;
  }

  let fallbackRow =
    Math.max(1, ...Array.from(placementById.values()).map((placement) => placement.row)) + 1;
  for (const orphanId of orphanIds) {
    placementById.set(orphanId, { row: fallbackRow, column: 1 });
    fallbackRow += 1;
  }

  const minimumRow = Math.min(
    1,
    ...Array.from(placementById.values()).map((placement) => placement.row)
  );
  const minimumColumn = Math.min(
    1,
    ...Array.from(placementById.values()).map((placement) => placement.column)
  );
  if (minimumRow < 1 || minimumColumn < 1) {
    const rowOffset = minimumRow < 1 ? 1 - minimumRow : 0;
    const colOffset = minimumColumn < 1 ? 1 - minimumColumn : 0;
    for (const [topicId, placement] of placementById.entries()) {
      placementById.set(topicId, {
        row: placement.row + rowOffset,
        column: placement.column + colOffset
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

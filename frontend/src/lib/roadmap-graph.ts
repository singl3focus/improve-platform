export interface RoadmapConnection {
  fromId: string;
  toId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface GraphSize {
  width: number;
  height: number;
}

export interface GraphPoint {
  x: number;
  y: number;
}

export type ConnectionAnchorSide = "left" | "right" | "top" | "bottom";

export interface GraphSceneTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export const ROADMAP_CONNECTION_ARROW_GAP = 18;
export const ROADMAP_CONNECTION_RIGHT_SIDE_GAP = 32;
export const ROADMAP_WHEEL_SCALE_STEP = 0.12;

export interface RoadmapWheelZoomBehavior {
  preventPageScroll: boolean;
  scaleDelta: number;
}

export function getConnectionAnchorOffsetDistance(side: ConnectionAnchorSide): number {
  return side === "right" ? ROADMAP_CONNECTION_RIGHT_SIDE_GAP : ROADMAP_CONNECTION_ARROW_GAP;
}

export function parsePositiveInteger(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

export function buildConnectionPath(x1: number, y1: number, x2: number, y2: number): string {
  const deltaX = x2 - x1;
  const deltaY = y2 - y1;

  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    const controlX = x1 + Math.sign(deltaX || 1) * Math.max(Math.abs(deltaX) * 0.5, 36);
    return `M ${x1} ${y1} C ${controlX} ${y1}, ${controlX} ${y2}, ${x2} ${y2}`;
  }

  const controlY = y1 + Math.sign(deltaY || 1) * Math.max(Math.abs(deltaY) * 0.5, 36);
  return `M ${x1} ${y1} C ${x1} ${controlY}, ${x2} ${controlY}, ${x2} ${y2}`;
}

export function getConnectionAnchorSides(
  sourcePoint: GraphPoint,
  targetPoint: GraphPoint
): {
  sourceSide: ConnectionAnchorSide;
  targetSide: ConnectionAnchorSide;
} {
  const deltaX = targetPoint.x - sourcePoint.x;
  const deltaY = targetPoint.y - sourcePoint.y;

  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    return deltaX >= 0
      ? { sourceSide: "right", targetSide: "left" }
      : { sourceSide: "left", targetSide: "right" };
  }

  return deltaY >= 0
    ? { sourceSide: "bottom", targetSide: "top" }
    : { sourceSide: "top", targetSide: "bottom" };
}

export function offsetConnectionAnchorPoint(
  point: GraphPoint,
  side: ConnectionAnchorSide,
  distance = getConnectionAnchorOffsetDistance(side)
): GraphPoint {
  if (distance <= 0) {
    return point;
  }

  if (side === "left") {
    return {
      x: point.x - distance,
      y: point.y
    };
  }

  if (side === "right") {
    return {
      x: point.x + distance,
      y: point.y
    };
  }

  if (side === "top") {
    return {
      x: point.x,
      y: point.y - distance
    };
  }

  return {
    x: point.x,
    y: point.y + distance
  };
}

export function normalizeGraphPoint(
  clientX: number,
  clientY: number,
  graphOffset: Pick<DOMRect, "left" | "top">,
  transform?: GraphSceneTransform
): GraphPoint {
  const nextPoint = {
    x: clientX - graphOffset.left,
    y: clientY - graphOffset.top
  };

  if (!transform) {
    return nextPoint;
  }

  return {
    x: (nextPoint.x - transform.offsetX) / transform.scale,
    y: (nextPoint.y - transform.offsetY) / transform.scale
  };
}

export function clampGraphScale(value: number, min = 0.6, max = 1.8): number {
  if (Number.isNaN(value)) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}

export function getGraphOffsetForScale(
  anchor: GraphPoint,
  current: GraphSceneTransform,
  nextScale: number
): GraphPoint {
  const worldX = (anchor.x - current.offsetX) / current.scale;
  const worldY = (anchor.y - current.offsetY) / current.scale;

  return {
    x: anchor.x - worldX * nextScale,
    y: anchor.y - worldY * nextScale
  };
}

export function getRoadmapWheelZoomBehavior(
  deltaY: number,
  viewportWidth: number,
  mobileBreakpoint: number,
  step = ROADMAP_WHEEL_SCALE_STEP
): RoadmapWheelZoomBehavior {
  const isDesktopViewport = Number.isFinite(viewportWidth) && viewportWidth > mobileBreakpoint;
  if (!isDesktopViewport || !Number.isFinite(deltaY) || deltaY === 0) {
    return {
      preventPageScroll: false,
      scaleDelta: 0
    };
  }

  return {
    preventPageScroll: true,
    scaleDelta: deltaY > 0 ? -step : step
  };
}

export function isDragGesture(
  start: GraphPoint,
  current: GraphPoint,
  threshold = 8
): boolean {
  return Math.hypot(current.x - start.x, current.y - start.y) >= threshold;
}

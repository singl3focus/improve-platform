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

export interface GraphSceneTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export function parsePositiveInteger(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

export function buildConnectionPath(x1: number, y1: number, x2: number, y2: number): string {
  const controlY = y1 + Math.max((y2 - y1) * 0.5, 36);
  return `M ${x1} ${y1} C ${x1} ${controlY}, ${x2} ${controlY}, ${x2} ${y2}`;
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

export function isDragGesture(
  start: GraphPoint,
  current: GraphPoint,
  threshold = 8
): boolean {
  return Math.hypot(current.x - start.x, current.y - start.y) >= threshold;
}

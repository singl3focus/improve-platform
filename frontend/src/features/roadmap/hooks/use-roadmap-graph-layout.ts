import { useEffect, useRef, useState } from "react";
import type { RoadmapResponse } from "@features/roadmap/types";
import {
  normalizeGraphPoint,
  type GraphSceneTransform,
  type GraphSize,
  type RoadmapConnection
} from "@features/roadmap/lib/roadmap-graph";
import { buildRoadmapConnections, readGraphSize } from "@features/roadmap/lib/roadmap-layout";

interface UseRoadmapGraphLayoutParams {
  status: "loading" | "success" | "error";
  data: RoadmapResponse | null;
  graphRef: { current: HTMLDivElement | null };
  sceneRef: { current: HTMLDivElement | null };
  topicRefs: { current: Map<string, HTMLElement> };
  transformRef: { current: GraphSceneTransform };
  layoutVersion: number;
}

export function useRoadmapGraphLayout(params: UseRoadmapGraphLayoutParams) {
  const [connections, setConnections] = useState<RoadmapConnection[]>([]);
  const [graphSize, setGraphSize] = useState<GraphSize>({
    width: 1,
    height: 1
  });
  const recalculateRef = useRef<() => void>(() => {});
  const lastConnectionsRef = useRef<RoadmapConnection[]>([]);
  const lastGraphSizeRef = useRef<GraphSize>({
    width: 1,
    height: 1
  });

  const areConnectionsEqual = (left: RoadmapConnection[], right: RoadmapConnection[]) => {
    if (left.length !== right.length) {
      return false;
    }

    for (let index = 0; index < left.length; index += 1) {
      const current = left[index];
      const next = right[index];
      if (
        current.fromId !== next.fromId ||
        current.toId !== next.toId ||
        current.x1 !== next.x1 ||
        current.y1 !== next.y1 ||
        current.x2 !== next.x2 ||
        current.y2 !== next.y2
      ) {
        return false;
      }
    }

    return true;
  };

  useEffect(() => {
    if (params.status !== "success" || !params.data) {
      setConnections([]);
      lastConnectionsRef.current = [];
      return;
    }

    const roadmapData = params.data;
    const graphElement = params.graphRef.current;
    const sceneElement = params.sceneRef.current;
    if (!graphElement || !sceneElement) {
      return;
    }

    let frame = 0;

    const recalculate = () => {
      const containerRect = graphElement.getBoundingClientRect();
      const topicRects = new Map<string, DOMRect>();
      for (const [topicId, topicElement] of params.topicRefs.current.entries()) {
        const topicRect = topicElement.getBoundingClientRect();
        const transform = params.transformRef.current;
        const topLeft = normalizeGraphPoint(topicRect.left, topicRect.top, containerRect, transform);
        topicRects.set(
          topicId,
          {
            left: topLeft.x,
            top: topLeft.y,
            width: topicRect.width / transform.scale,
            bottom: topLeft.y + topicRect.height / transform.scale
          } as DOMRect
        );
      }

      const nextConnections = buildRoadmapConnections(roadmapData, { left: 0, top: 0 }, topicRects);
      const nextGraphSize = readGraphSize(sceneElement);

      if (!areConnectionsEqual(lastConnectionsRef.current, nextConnections)) {
        lastConnectionsRef.current = nextConnections;
        setConnections(nextConnections);
      }

      if (
        lastGraphSizeRef.current.width !== nextGraphSize.width ||
        lastGraphSizeRef.current.height !== nextGraphSize.height
      ) {
        lastGraphSizeRef.current = nextGraphSize;
        setGraphSize(nextGraphSize);
      }
    };

    const scheduleRecalculate = () => {
      if (frame !== 0) {
        return;
      }

      frame = requestAnimationFrame(() => {
        frame = 0;
        recalculate();
      });
    };

    recalculateRef.current = scheduleRecalculate;
    scheduleRecalculate();

    const resizeObserver = new ResizeObserver(scheduleRecalculate);
    resizeObserver.observe(graphElement);
    resizeObserver.observe(sceneElement);

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
    };
  }, [
    params.status,
    params.data,
    params.graphRef,
    params.sceneRef,
    params.topicRefs,
    params.transformRef,
    params.layoutVersion
  ]);

  useEffect(() => {
    recalculateRef.current();
  }, [params.layoutVersion]);

  return {
    connections,
    graphSize,
    recalculate: () => recalculateRef.current()
  };
}

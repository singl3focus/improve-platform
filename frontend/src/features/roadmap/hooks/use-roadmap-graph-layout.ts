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
  topicRefs: { current: Map<string, HTMLElement> };
  transform: GraphSceneTransform;
}

export function useRoadmapGraphLayout(params: UseRoadmapGraphLayoutParams) {
  const transformRef = useRef(params.transform);
  const [connections, setConnections] = useState<RoadmapConnection[]>([]);
  const [graphSize, setGraphSize] = useState<GraphSize>({
    width: 1,
    height: 1
  });

  useEffect(() => {
    transformRef.current = params.transform;
  }, [params.transform]);

  useEffect(() => {
    if (params.status !== "success" || !params.data) {
      setConnections([]);
      return;
    }

    const roadmapData = params.data;
    const graphElement = params.graphRef.current;
    if (!graphElement) {
      return;
    }

    let frame = 0;

    const recalculate = () => {
      const containerRect = graphElement.getBoundingClientRect();
      const topicRects = new Map<string, DOMRect>();
      for (const [topicId, topicElement] of params.topicRefs.current.entries()) {
        const topicRect = topicElement.getBoundingClientRect();
        const transform = transformRef.current;
        const topLeft = normalizeGraphPoint(
          topicRect.left,
          topicRect.top,
          containerRect,
          transform
        );
        topicRects.set(topicId, {
          left: topLeft.x,
          top: topLeft.y,
          width: topicRect.width / transform.scale,
          bottom: topLeft.y + topicRect.height / transform.scale
        } as DOMRect);
      }

      setConnections(buildRoadmapConnections(roadmapData, { left: 0, top: 0 }, topicRects));
      setGraphSize(readGraphSize(graphElement));
    };

    const scheduleRecalculate = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(recalculate);
    };

    scheduleRecalculate();
    window.addEventListener("resize", scheduleRecalculate);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", scheduleRecalculate);
    };
  }, [
    params.status,
    params.data,
    params.graphRef,
    params.topicRefs
  ]);

  return {
    connections,
    graphSize
  };
}

import { useEffect, useState } from "react";
import type { RoadmapResponse } from "@/lib/roadmap-types";
import type { GraphSize, RoadmapConnection } from "@/lib/roadmap-graph";
import { buildRoadmapConnections, readGraphSize } from "@/lib/roadmap-layout";

interface UseRoadmapGraphLayoutParams {
  status: "loading" | "success" | "error";
  data: RoadmapResponse | null;
  graphRef: { current: HTMLDivElement | null };
  topicRefs: { current: Map<string, HTMLElement> };
}

export function useRoadmapGraphLayout(params: UseRoadmapGraphLayoutParams) {
  const [connections, setConnections] = useState<RoadmapConnection[]>([]);
  const [graphSize, setGraphSize] = useState<GraphSize>({
    width: 1,
    height: 1
  });

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
        topicRects.set(topicId, topicElement.getBoundingClientRect());
      }

      setConnections(buildRoadmapConnections(roadmapData, containerRect, topicRects));
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

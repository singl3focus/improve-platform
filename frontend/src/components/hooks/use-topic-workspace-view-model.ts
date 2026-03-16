"use client";

import { useEffect, useMemo, useState } from "react";
import type { TopicWorkspace } from "@/lib/topic-workspace-types";

type TopicLoadStatus = "idle" | "loading" | "success" | "error";

interface TopicResourceState {
  status: TopicLoadStatus;
  data: TopicWorkspace | null;
  errorMessage: string | null;
}

function initialTopicState(status: TopicLoadStatus = "loading"): TopicResourceState {
  return {
    status,
    data: null,
    errorMessage: null
  };
}

async function parseErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: string };
    if (typeof payload?.message === "string") {
      return payload.message;
    }
  } catch {
    // Ignore non-JSON errors.
  }
  return fallback;
}

async function fetchTopicWorkspace(topicId: string, signal: AbortSignal): Promise<TopicWorkspace> {
  const response = await fetch(`/api/topics/${encodeURIComponent(topicId)}`, {
    method: "GET",
    cache: "no-store",
    signal
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "Topic workspace request failed."));
  }

  return (await response.json()) as TopicWorkspace;
}

export function useTopicWorkspaceViewModel(topicId: string | null, loadErrorFallback: string) {
  const [state, setState] = useState<TopicResourceState>(() =>
    initialTopicState(topicId ? "loading" : "idle")
  );
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!topicId) {
      setState(initialTopicState("idle"));
      return;
    }

    const currentTopicId = topicId;
    const controller = new AbortController();

    async function load() {
      setState(initialTopicState());
      try {
        const topic = await fetchTopicWorkspace(currentTopicId, controller.signal);
        setState({
          status: "success",
          data: topic,
          errorMessage: null
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setState({
          status: "error",
          data: null,
          errorMessage: error instanceof Error ? error.message : loadErrorFallback
        });
      }
    }

    void load();
    return () => controller.abort();
  }, [topicId, reloadKey, loadErrorFallback]);

  const dependencySummary = useMemo(() => {
    const topic = state.data;
    if (!topic) {
      return {
        completed: 0,
        blocked: 0
      };
    }

    return {
      completed: topic.dependencies.filter((dependency) => dependency.isCompleted).length,
      blocked: topic.dependencies.filter((dependency) => dependency.isRequired && !dependency.isCompleted)
        .length
    };
  }, [state.data]);

  return {
    state,
    reload: () => setReloadKey((value) => value + 1),
    dependencySummary
  };
}

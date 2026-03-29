"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Map, Plus } from "lucide-react";
import { authFetch } from "@features/auth/lib/auth-fetch";
import type { RoadmapListItem } from "@features/roadmap/types";
import { RoadmapCreateForm } from "@features/roadmap/components/roadmap-create-form";
import { prepareRoadmapCreateSubmission } from "@features/roadmap/lib/roadmap-create";
import type { BackendRoadmapListItem } from "@shared/api/backend-contracts";
import { useUserPreferences } from "@shared/providers/user-preferences-provider";

type RoadmapSwitcherProps = {
  className?: string;
};

export function RoadmapSwitcher({ className }: RoadmapSwitcherProps) {
  const { copy, activeRoadmapId, setActiveRoadmapId } = useUserPreferences();
  const [roadmaps, setRoadmaps] = useState<RoadmapListItem[]>([]);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createDraft, setCreateDraft] = useState<{ title: string; type: "graph" | "levels" | "cycles" }>({
    title: "",
    type: "graph"
  });
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadRoadmaps = useCallback(async () => {
    try {
      const res = await authFetch("/api/roadmaps");
      if (!res.ok) {
        return;
      }

      const raw = (await res.json()) as BackendRoadmapListItem[];
      const data: RoadmapListItem[] = raw.map((roadmap) => ({
        id: roadmap.id,
        title: roadmap.title,
        type: roadmap.type,
        totalTopics: roadmap.total_topics,
        completedTopics: roadmap.completed_topics,
        progressPercent: roadmap.progress_percent,
        createdAt: roadmap.created_at,
        updatedAt: roadmap.updated_at
      }));

      setRoadmaps(data);

      if (!activeRoadmapId && data.length > 0) {
        setActiveRoadmapId(data[0].id);
      }
    } catch {
      // Ignore load errors in switcher; roadmap view handles loading state.
    }
  }, [activeRoadmapId, setActiveRoadmapId]);

  useEffect(() => {
    void loadRoadmaps();
  }, [loadRoadmaps]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("roadmap-switcher-open", open);
    return () => document.body.classList.remove("roadmap-switcher-open");
  }, [open]);

  const activeRoadmap = roadmaps.find((roadmap) => roadmap.id === activeRoadmapId);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const submission = prepareRoadmapCreateSubmission(createDraft);
    if (!submission.ok) {
      setCreateError("Укажите название roadmap.");
      return;
    }

    try {
      setCreateError(null);
      setIsCreating(true);
      const res = await authFetch("/api/roadmaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submission.payload)
      });
      if (!res.ok) {
        setCreateError("Не удалось создать roadmap.");
        return;
      }

      const created = await res.json();
      setActiveRoadmapId(created.id);
      setCreateDraft({
        title: "",
        type: "graph"
      });
      setCreating(false);
      setOpen(false);
      await loadRoadmaps();
    } catch {
      setCreateError("Не удалось создать roadmap.");
    } finally {
      setIsCreating(false);
    }
  }

  if (roadmaps.length === 0) {
    return null;
  }

  return (
    <div className={className ?? "roadmap-switcher"} ref={dropdownRef}>
      <button
        type="button"
        className="roadmap-switcher-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Map size={14} />
        <span className="roadmap-switcher-label">
          {activeRoadmap?.title ?? copy.dashboard.roadmapSwitcherLabel}
        </span>
        <ChevronDown size={14} />
      </button>

      {open ? (
        <div className="roadmap-switcher-dropdown">
          {roadmaps.map((roadmap) => (
            <button
              key={roadmap.id}
              type="button"
              className={`roadmap-switcher-item${
                roadmap.id === activeRoadmapId ? " roadmap-switcher-item-active" : ""
              }`}
              onClick={() => {
                setActiveRoadmapId(roadmap.id);
                setOpen(false);
              }}
            >
              {roadmap.id === activeRoadmapId ? <Check size={14} /> : null}
              {roadmap.title}
            </button>
          ))}

          <div className="roadmap-switcher-divider" />

          {creating ? (
            <RoadmapCreateForm
              className="roadmap-create-panel roadmap-switcher-create-panel"
              copy={{
                title: "Новый roadmap",
                description: "Выберите тип и название. Переключение между roadmap в хедере останется доступно.",
                roadmapTitleLabel: "Название roadmap",
                roadmapTitlePlaceholder: copy.dashboard.newRoadmapPlaceholder,
                typeLabel: "Тип roadmap",
                submitLabel: "Создать roadmap",
                submitLoadingLabel: "Создание...",
                graphLabel: "Graph",
                graphDescription: "Связанный граф тем и зависимостей.",
                levelsLabel: "Levels",
                levelsDescription: "Последовательные уровни освоения.",
                cyclesLabel: "Cycles",
                cyclesDescription: "Повторяющиеся циклы улучшения."
              }}
              draft={createDraft}
              error={createError}
              isSubmitting={isCreating}
              onSubmit={handleCreate}
              onTitleChange={(value) =>
                setCreateDraft((current) => ({
                  ...current,
                  title: value
                }))
              }
              onTypeChange={(value) =>
                setCreateDraft((current) => ({
                  ...current,
                  type: value
                }))
              }
            />
          ) : (
            <button
              type="button"
              className="roadmap-switcher-item roadmap-switcher-new"
              onClick={() => {
                setCreateError(null);
                setCreating(true);
              }}
            >
              <Plus size={14} />
              Создать roadmap
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

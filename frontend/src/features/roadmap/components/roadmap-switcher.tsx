"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Map, Plus } from "lucide-react";
import { authFetch } from "@features/auth/lib/auth-fetch";
import type { RoadmapListItem } from "@features/roadmap/types";
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
  const [newTitle, setNewTitle] = useState("");
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

  async function handleCreate() {
    if (!newTitle.trim()) {
      return;
    }

    try {
      const res = await authFetch("/api/roadmaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim() })
      });
      if (!res.ok) {
        return;
      }

      const created = await res.json();
      setActiveRoadmapId(created.id);
      setNewTitle("");
      setCreating(false);
      setOpen(false);
      await loadRoadmaps();
    } catch {
      // Ignore create errors in switcher; roadmap view handles loading state.
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
            <div className="roadmap-switcher-create-form">
              <input
                type="text"
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                placeholder={copy.dashboard.newRoadmapPlaceholder}
                className="roadmap-switcher-create-input"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void handleCreate();
                  }
                  if (event.key === "Escape") {
                    setCreating(false);
                  }
                }}
                autoFocus
              />
              <button
                type="button"
                className="roadmap-switcher-create-confirm"
                onClick={() => void handleCreate()}
                disabled={!newTitle.trim()}
              >
                <Plus size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="roadmap-switcher-item roadmap-switcher-new"
              onClick={() => setCreating(true)}
            >
              <Plus size={14} />
              {copy.dashboard.newRoadmapPlaceholder}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

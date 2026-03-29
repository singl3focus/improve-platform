"use client";

import type { FormEvent } from "react";
import { GitBranch, Layers3, RotateCw } from "lucide-react";
import type { RoadmapType } from "@features/roadmap/types";

interface RoadmapCreateFormCopy {
  title: string;
  description: string;
  roadmapTitleLabel: string;
  roadmapTitlePlaceholder: string;
  typeLabel: string;
  submitLabel: string;
  submitLoadingLabel: string;
  graphLabel: string;
  graphDescription: string;
  levelsLabel: string;
  levelsDescription: string;
  cyclesLabel: string;
  cyclesDescription: string;
}

interface RoadmapCreateFormProps {
  copy: RoadmapCreateFormCopy;
  draft: {
    title: string;
    type: RoadmapType;
  };
  error?: string | null;
  isSubmitting: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onTitleChange: (value: string) => void;
  onTypeChange: (value: RoadmapType) => void;
  className?: string;
}

const ROADMAP_TYPE_OPTIONS: Array<{
  type: RoadmapType;
  icon: typeof GitBranch;
  labelKey: keyof Pick<
    RoadmapCreateFormCopy,
    "graphLabel" | "levelsLabel" | "cyclesLabel"
  >;
  descriptionKey: keyof Pick<
    RoadmapCreateFormCopy,
    "graphDescription" | "levelsDescription" | "cyclesDescription"
  >;
}> = [
  {
    type: "graph",
    icon: GitBranch,
    labelKey: "graphLabel",
    descriptionKey: "graphDescription"
  },
  {
    type: "levels",
    icon: Layers3,
    labelKey: "levelsLabel",
    descriptionKey: "levelsDescription"
  },
  {
    type: "cycles",
    icon: RotateCw,
    labelKey: "cyclesLabel",
    descriptionKey: "cyclesDescription"
  }
];

export function RoadmapCreateForm(props: RoadmapCreateFormProps) {
  return (
    <section className={props.className ?? "roadmap-create-panel"}>
      <header className="roadmap-create-panel-header">
        <h3>{props.copy.title}</h3>
        <p>{props.copy.description}</p>
      </header>

      {props.error ? (
        <div className="dashboard-error">
          <p>{props.error}</p>
        </div>
      ) : null}

      <form className="roadmap-create-form" onSubmit={props.onSubmit}>
        <label className="roadmap-create-field">
          <span>{props.copy.roadmapTitleLabel}</span>
          <input
            type="text"
            className="input"
            value={props.draft.title}
            onChange={(event) => props.onTitleChange(event.target.value)}
            placeholder={props.copy.roadmapTitlePlaceholder}
          />
        </label>

        <fieldset className="roadmap-type-picker">
          <legend>{props.copy.typeLabel}</legend>
          <div className="roadmap-type-picker-grid">
            {ROADMAP_TYPE_OPTIONS.map((option) => {
              const Icon = option.icon;
              const selected = props.draft.type === option.type;
              return (
                <button
                  key={option.type}
                  type="button"
                  className={`roadmap-type-card${selected ? " roadmap-type-card-active" : ""}`}
                  onClick={() => props.onTypeChange(option.type)}
                >
                  <span className="roadmap-type-card-icon">
                    <Icon size={18} />
                  </span>
                  <span className="roadmap-type-card-copy">
                    <strong>{props.copy[option.labelKey]}</strong>
                    <span>{props.copy[option.descriptionKey]}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <button type="submit" className="button button-primary roadmap-create-submit" disabled={props.isSubmitting}>
          {props.isSubmitting ? props.copy.submitLoadingLabel : props.copy.submitLabel}
        </button>
      </form>
    </section>
  );
}

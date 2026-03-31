"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@features/auth/lib/auth-fetch";
import { useUserPreferences } from "@shared/providers/user-preferences-provider";
import type { ActivityHeatmap as ActivityHeatmapData, ActivityDay } from "@features/dashboard/types";

async function fetchHeatmap(): Promise<ActivityHeatmapData> {
  const response = await authFetch("/api/dashboard/activity-heatmap", { method: "GET" });
  if (!response.ok) throw new Error("Failed to load heatmap");
  return (await response.json()) as ActivityHeatmapData;
}

const INTENSITY_COLORS = [
  "var(--heatmap-0)",
  "var(--heatmap-1)",
  "var(--heatmap-2)",
  "var(--heatmap-3)",
  "var(--heatmap-4)"
];

function getIntensity(count: number): number {
  if (count === 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 9) return 3;
  return 4;
}

interface HeatmapCopy {
  title: string;
  streak: (n: number) => string;
  activeDays: (n: number) => string;
  tooltip: (date: string, count: number) => string;
  loading: string;
  months: string[];
  less: string;
  more: string;
}

const RU_HEATMAP: HeatmapCopy = {
  title: "Активность",
  streak: (n) => `Серия: ${n} дн.`,
  activeDays: (n) => `Активных дней: ${n}`,
  tooltip: (date, count) => `${date}: ${count} активностей`,
  loading: "Загрузка...",
  months: ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"],
  less: "Меньше",
  more: "Больше"
};

const EN_HEATMAP: HeatmapCopy = {
  title: "Activity",
  streak: (n) => `Streak: ${n} days`,
  activeDays: (n) => `Active days: ${n}`,
  tooltip: (date, count) => `${date}: ${count} activities`,
  loading: "Loading...",
  months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  less: "Less",
  more: "More"
};

function buildGrid(days: ActivityDay[]) {
  const dayMap = new Map<string, number>();
  for (const d of days) {
    dayMap.set(d.date, d.count);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Go back 52 weeks + remaining days to align to Sunday start
  const start = new Date(today);
  start.setDate(start.getDate() - 364);
  // Align to previous Sunday
  const startDay = start.getDay();
  start.setDate(start.getDate() - startDay);

  const cells: { date: string; count: number; dayOfWeek: number; weekIndex: number }[] = [];
  const current = new Date(start);
  let weekIndex = 0;

  while (current <= today) {
    const dateStr = current.toISOString().slice(0, 10);
    cells.push({
      date: dateStr,
      count: dayMap.get(dateStr) ?? 0,
      dayOfWeek: current.getDay(),
      weekIndex
    });
    current.setDate(current.getDate() + 1);
    if (current.getDay() === 0) weekIndex++;
  }

  return { cells, totalWeeks: weekIndex + 1, start };
}

function getMonthLabels(start: Date, totalWeeks: number, months: string[]) {
  const rawLabels: { label: string; weekIndex: number }[] = [];
  const current = new Date(start);
  let lastMonth = -1;
  const MIN_WEEK_GAP = 2;

  for (let w = 0; w < totalWeeks; w++) {
    const month = current.getMonth();
    if (month !== lastMonth) {
      rawLabels.push({ label: months[month], weekIndex: w });
      lastMonth = month;
    }
    current.setDate(current.getDate() + 7);
  }

  const labels: { label: string; weekIndex: number }[] = [];
  for (const next of rawLabels) {
    const prev = labels[labels.length - 1];
    if (!prev) {
      labels.push(next);
      continue;
    }

    if (next.weekIndex - prev.weekIndex < MIN_WEEK_GAP) {
      // Keep the latest month label when two starts are too close.
      labels[labels.length - 1] = next;
      continue;
    }

    labels.push(next);
  }

  return labels;
}

export function ActivityHeatmap({ data: initialData }: { data?: ActivityHeatmapData | null }) {
  const { language } = useUserPreferences();
  const isRu = language === "ru";
  const copy = isRu ? RU_HEATMAP : EN_HEATMAP;
  const [tooltip, setTooltip] = useState<string | null>(null);

  const heatmapQuery = useQuery({
    queryKey: ["activity-heatmap"],
    queryFn: fetchHeatmap,
    staleTime: 60 * 1000,
    enabled: !initialData
  });
  const data = initialData ?? heatmapQuery.data;
  const isLoading = !initialData && heatmapQuery.isLoading;

  const grid = useMemo(() => {
    if (!data) return null;
    return buildGrid(data.days);
  }, [data]);

  const monthLabels = useMemo(() => {
    if (!grid) return [];
    return getMonthLabels(grid.start, grid.totalWeeks, copy.months);
  }, [grid, copy.months]);

  if (isLoading || !data || !grid) {
    return (
      <section className="heatmap-section">
        <h3 className="heatmap-title">{copy.title}</h3>
        <p className="heatmap-loading">{copy.loading}</p>
      </section>
    );
  }

  const CELL = 12;
  const GAP = 2;
  const STEP = CELL + GAP;
  const LEFT_PAD = 28;
  const TOP_PAD = 18;
  const svgWidth = LEFT_PAD + grid.totalWeeks * STEP;
  const svgHeight = TOP_PAD + 7 * STEP;
  const dayLabels = isRu ? ["", "Пн", "", "Ср", "", "Пт", ""] : ["", "Mon", "", "Wed", "", "Fri", ""];

  return (
    <section className="heatmap-section">
      <div className="heatmap-header">
        <h3 className="heatmap-title">{copy.title}</h3>
        <div className="heatmap-stats">
          <span>{copy.streak(data.streak)}</span>
          <span>{copy.activeDays(data.totalActiveDays)}</span>
        </div>
      </div>

      <div className="heatmap-scroll">
        <svg width={svgWidth} height={svgHeight} className="heatmap-svg">
          {monthLabels.map((m, i) => (
            <text
              key={i}
              x={LEFT_PAD + m.weekIndex * STEP}
              y={12}
              className="heatmap-month-label"
            >
              {m.label}
            </text>
          ))}

          {dayLabels.map((label, i) =>
            label ? (
              <text
                key={i}
                x={0}
                y={TOP_PAD + i * STEP + CELL - 2}
                className="heatmap-day-label"
              >
                {label}
              </text>
            ) : null
          )}

          {grid.cells.map((cell, i) => (
            <rect
              key={i}
              x={LEFT_PAD + cell.weekIndex * STEP}
              y={TOP_PAD + cell.dayOfWeek * STEP}
              width={CELL}
              height={CELL}
              rx={2}
              fill={INTENSITY_COLORS[getIntensity(cell.count)]}
              onMouseEnter={() => setTooltip(copy.tooltip(cell.date, cell.count))}
              onMouseLeave={() => setTooltip(null)}
            />
          ))}
        </svg>
      </div>

      <div className="heatmap-footer">
        <div className="heatmap-legend">
          <span>{copy.less}</span>
          {INTENSITY_COLORS.map((color, i) => (
            <span key={i} className="heatmap-legend-cell" style={{ background: color }} />
          ))}
          <span>{copy.more}</span>
        </div>
      </div>

      {tooltip && <div className="heatmap-tooltip">{tooltip}</div>}
    </section>
  );
}

"use client";

import { KeyboardEvent, ReactNode, memo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  DASHBOARD_OVERVIEW_QUERY_KEY,
  formatDashboardDate,
  hasDailySummaryContent,
  hasRoadmapProgress,
  isDashboardTaskOverdue,
  useDashboardViewModel
} from "@features/dashboard/hooks/use-dashboard-view-model";
import type {
  DashboardChartsPayload,
  DashboardDailySummary,
  DashboardFocus,
  DashboardHistoryEvent,
  DashboardOverviewResponse,
  DashboardProgress,
  DashboardRecentMaterial,
  DashboardTask,
  DashboardTopicInProgress
} from "@features/dashboard/types";
import type { DashboardCopy } from "@shared/i18n/ui-copy";
import { DashboardCalendarRibbon } from "@features/dashboard/components/dashboard-calendar-ribbon";
import { ActivityHeatmap } from "@features/dashboard/components/activity-heatmap";
import {
  formatHistoryEventBadge,
  formatHistoryEventSubtitle,
  formatHistoryEventTitle
} from "@features/history/lib/format-history-event";
import { authFetch } from "@features/auth/lib/auth-fetch";

const MOMENTUM_COPY = {
  ru: {
    title: "Динамика обучения",
    description: "Темп недели, фокус и общее движение вперёд.",
    focusHours: "Фокус-часы",
    roadmap: "Закрыто тем",
    activePlans: "Активных планов",
    weeklyReviewNote: "Пять минут на обзор недели и следующий шаг."
  },
  en: {
    title: "Learning momentum",
    description: "Weekly pace, focus rhythm, and visible forward motion.",
    focusHours: "Focus hours",
    roadmap: "Topics closed",
    activePlans: "Active plans",
    weeklyReviewNote: "Take five minutes to review the week and the next move."
  }
} as const;

function DashboardPanel({
  title,
  description,
  href,
  children,
  copy
}: {
  title: string;
  description: string;
  href: string;
  children: ReactNode;
  copy: DashboardCopy;
}) {
  const router = useRouter();

  function openPanel() {
    router.push(href);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPanel();
    }
  }

  return (
    <section
      className="dashboard-panel"
      role="link"
      tabIndex={0}
      onClick={openPanel}
      onKeyDown={handleKeyDown}
      aria-label={copy.panelAriaLabel(title)}
    >
      <header className="dashboard-panel-header">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <span className="dashboard-panel-open">{copy.open}</span>
      </header>
      {children}
    </section>
  );
}

function DashboardLoading({ lines = 3 }: { lines?: number }) {
  return (
    <div className="dashboard-loading" aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <span key={index} />
      ))}
    </div>
  );
}

function DashboardEmpty({ message }: { message: string }) {
  return <p className="dashboard-empty">{message}</p>;
}

function DashboardError({
  message,
  onRetry,
  retryLabel
}: {
  message: string;
  onRetry: () => void;
  retryLabel: string;
}) {
  return (
    <div className="dashboard-error">
      <p>{message}</p>
      <button type="button" className="button button-outline dashboard-retry" onClick={onRetry}>
        {retryLabel}
      </button>
    </div>
  );
}

function formatChartDayLabel(value: string, locale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "2-digit"
  }).format(date);
}

const DashboardChartsSection = memo(function DashboardChartsSection({
  copy,
  locale,
  charts
}: {
  copy: DashboardCopy;
  locale: string;
  charts: DashboardChartsPayload;
}) {
  const topicsByStatusItems = [
    {
      label: copy.chartStatusNotStarted,
      value: charts.topicsByStatus.notStarted,
      className: "dashboard-chart-bar-not-started"
    },
    {
      label: copy.chartStatusInProgress,
      value: charts.topicsByStatus.inProgress,
      className: "dashboard-chart-bar-in-progress"
    },
    {
      label: copy.chartStatusPaused,
      value: charts.topicsByStatus.paused,
      className: "dashboard-chart-bar-paused"
    },
    {
      label: copy.chartStatusCompleted,
      value: charts.topicsByStatus.completed,
      className: "dashboard-chart-bar-completed"
    }
  ];
  const topicsByStatusTotal = topicsByStatusItems.reduce((sum, item) => sum + item.value, 0);
  const topicsByStatusMax = Math.max(1, ...topicsByStatusItems.map((item) => item.value));
  const deadlinesMax = Math.max(1, ...charts.upcomingDeadlines.map((entry) => entry.count));
  const isEmpty =
    topicsByStatusItems.every((item) => item.value === 0) &&
    charts.upcomingDeadlines.every((entry) => entry.count === 0);

  return (
    <section className="dashboard-charts panel">
      <header className="dashboard-charts-header">
        <h3>{copy.chartsTitle}</h3>
        <p>{copy.chartsDescription}</p>
      </header>
      {isEmpty ? (
        <DashboardEmpty message={copy.chartsEmpty} />
      ) : (
        <div className="dashboard-charts-grid">
          <section className="dashboard-chart-card">
            <h4>{copy.chartTopicsByStatusTitle}</h4>
            <ul className="dashboard-chart-list">
              {topicsByStatusItems.map((item) => {
                const pct = topicsByStatusTotal > 0 ? Math.round((item.value / topicsByStatusTotal) * 100) : 0;
                return (
                  <li key={item.label} className="dashboard-chart-list-item">
                    <span>{item.label}</span>
                    <div className="dashboard-chart-bar-track" aria-hidden="true">
                      <span
                        className={`dashboard-chart-bar-fill ${item.className}`}
                        style={{ width: `${Math.round((item.value / topicsByStatusMax) * 100)}%` }}
                      />
                    </div>
                    <strong>
                      {item.value} ({pct}%)
                    </strong>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="dashboard-chart-card">
            <h4>{copy.chartDeadlinesTitle}</h4>
            <ul className="dashboard-chart-list">
              {charts.upcomingDeadlines.map((entry) => (
                <li key={entry.date} className="dashboard-chart-list-item">
                  <span>{copy.chartDeadlinesDayLabel(formatChartDayLabel(entry.date, locale))}</span>
                  <div className="dashboard-chart-bar-track" aria-hidden="true">
                    <span
                      className="dashboard-chart-bar-fill dashboard-chart-bar-deadline"
                      style={{ width: `${Math.round((entry.count / deadlinesMax) * 100)}%` }}
                    />
                  </div>
                  <strong>{copy.chartCountLabel(entry.count)}</strong>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </section>
  );
});

function focusPriorityLabel(level: string, copy: DashboardCopy): string {
  switch (level) {
    case "overdue":
      return copy.focusPriorityOverdue;
    case "due_today":
      return copy.focusPriorityToday;
    default:
      return copy.focusPriorityActive;
  }
}

function focusPriorityClass(level: string): string {
  switch (level) {
    case "overdue":
      return "dashboard-badge-overdue";
    case "due_today":
      return "dashboard-badge-today";
    default:
      return "";
  }
}

const DashboardFocusSection = memo(function DashboardFocusSection({
  focus,
  copy,
  todayLabel,
  onMarkDone
}: {
  focus: DashboardFocus;
  copy: DashboardCopy;
  todayLabel: string;
  onMarkDone: (taskId: string) => Promise<void>;
}) {
  const router = useRouter();
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);

  if (!focus.primaryTask) {
    return (
      <section className="dashboard-focus panel dashboard-focus-panel">
        <header className="dashboard-focus-header">
          <div>
            <p className="dashboard-eyebrow">{copy.focusToday}</p>
            <h3>{copy.focusToday}</h3>
          </div>
          <span className="dashboard-focus-date">{todayLabel}</span>
        </header>
        <div className="dashboard-empty dashboard-focus-empty">
          <p>{copy.focusEmptyState}</p>
          <button type="button" className="button button-outline" onClick={() => router.push("/tasks")}>
            {copy.open}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="dashboard-focus panel dashboard-focus-panel">
      <header className="dashboard-focus-header">
        <div>
          <p className="dashboard-eyebrow">{copy.focusToday}</p>
          <h3>{copy.focusToday}</h3>
        </div>
        <span className="dashboard-focus-date">{todayLabel}</span>
      </header>

      <div className="dashboard-focus-main">
        <div className="dashboard-focus-copy">
          <span className={`dashboard-badge ${focusPriorityClass(focus.primaryTask.priorityLevel)}`}>
            {focusPriorityLabel(focus.primaryTask.priorityLevel, copy)}
          </span>
          <p className="dashboard-focus-title">{focus.primaryTask.title}</p>
          <p className="dashboard-focus-subtitle">
            {focus.primaryTask.topicTitle ?? copy.noTopic}
            {" · "}
            {focus.primaryTask.deadline ? `Due: ${focus.primaryTask.deadline}` : copy.focusNoDue}
          </p>
        </div>

        <div className="dashboard-focus-actions">
          <button
            type="button"
            className="button button-primary"
            disabled={busyTaskId === focus.primaryTask.id}
            onClick={async () => {
              setBusyTaskId(focus.primaryTask?.id ?? null);
              try {
                await onMarkDone(focus.primaryTask!.id);
              } finally {
                setBusyTaskId(null);
              }
            }}
          >
            {copy.focusMarkDone}
          </button>
          <button type="button" className="button button-outline" onClick={() => router.push("/tasks")}>
            {copy.open}
          </button>
        </div>
      </div>

      {focus.secondaryTasks.length > 0 ? (
        <div className="dashboard-focus-support">
          <p className="dashboard-focus-section-label">{copy.focusAlsoToday}</p>
          <ul className="dashboard-list dashboard-focus-list">
            {focus.secondaryTasks.map((task) => (
              <li key={task.id} className="dashboard-list-item">
                <div>
                  <p className="dashboard-list-title">{task.title}</p>
                  <p className="dashboard-list-subtitle">{task.topicTitle ?? copy.noTopic}</p>
                </div>
                <button
                  type="button"
                  className="button button-outline dashboard-list-mini-action"
                  onClick={(event) => {
                    event.stopPropagation();
                    router.push("/tasks");
                  }}
                >
                  в†’
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {focus.continueTopic ? (
        <div className="dashboard-focus-support">
          <p className="dashboard-focus-section-label">{copy.focusContinue}</p>
          <div
            className="dashboard-list-item dashboard-focus-topic"
            onClick={() => router.push(`/topics?topicId=${focus.continueTopic!.id}`)}
          >
            <div>
              <p className="dashboard-list-title">{focus.continueTopic.title}</p>
              <p className="dashboard-list-subtitle">Last: {focus.continueTopic.lastTaskTitle}</p>
            </div>
            <span className="dashboard-badge">{focus.continueTopic.progressPercent}%</span>
          </div>
        </div>
      ) : null}
    </section>
  );
});

const DashboardMomentumSection = memo(function DashboardMomentumSection({
  progress,
  roadmapCount,
  roadmapProgressLabel,
  copy,
  language
}: {
  progress: DashboardProgress;
  roadmapCount: number;
  roadmapProgressLabel: string;
  copy: DashboardCopy;
  language: "ru" | "en";
}) {
  const momentumCopy = MOMENTUM_COPY[language];

  return (
    <section className="dashboard-hero-progress panel dashboard-momentum-panel">
      <header className="dashboard-momentum-header">
        <div>
          <p className="dashboard-eyebrow">{momentumCopy.title}</p>
          <h3>{momentumCopy.title}</h3>
          <p>{momentumCopy.description}</p>
        </div>
        <span className="dashboard-momentum-pill">{roadmapProgressLabel}</span>
      </header>

      <div className="dashboard-momentum-grid">
        <article className="dashboard-momentum-card">
          <span>{momentumCopy.focusHours}</span>
          <strong>{`${progress.focusHoursCompleted}/${progress.focusHoursTarget}`}</strong>
        </article>
        <article className="dashboard-momentum-card">
          <span>{momentumCopy.roadmap}</span>
          <strong>{`${progress.completedTopics}/${progress.totalTopics}`}</strong>
        </article>
        <article className="dashboard-momentum-card">
          <span>{momentumCopy.activePlans}</span>
          <strong>{roadmapCount}</strong>
        </article>
      </div>

      {hasRoadmapProgress(progress) ? (
        <div className="dashboard-momentum-progress">
          <div className="dashboard-progress-track">
            <span
              className="dashboard-progress-fill"
              style={{ width: `${progress.roadmapProgressPercent}%` }}
            />
          </div>
        </div>
      ) : (
        <DashboardEmpty message={copy.roadmapProgressEmpty} />
      )}
    </section>
  );
});

const DashboardSnapshotSection = memo(function DashboardSnapshotSection({
  summary,
  roadmapList,
  progress,
  roadmapProgressLabel,
  copy
}: {
  summary: DashboardDailySummary;
  roadmapList: DashboardOverviewResponse["roadmapList"];
  progress: DashboardProgress;
  roadmapProgressLabel: string;
  copy: DashboardCopy;
}) {
  const router = useRouter();

  function onHeroKeyDown(event: KeyboardEvent<HTMLElement>, href: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      router.push(href);
    }
  }

  return (
    <section className="dashboard-hero">
      <div
        className="dashboard-hero-main dashboard-hero-clickable"
        role="link"
        tabIndex={0}
        onClick={() => router.push("/tasks?filter=today")}
        onKeyDown={(event) => onHeroKeyDown(event, "/tasks?filter=today")}
      >
        <h2>{copy.snapshotTitle}</h2>
        {hasDailySummaryContent(summary) ? (
          <>
            {summary.nextTaskTitle ? <p className="dashboard-hero-headline">{summary.nextTaskTitle}</p> : null}
            <p className="dashboard-hero-focus">{copy.upcomingTasksMetric(summary.upcomingTasksCount)}</p>
            <div className="dashboard-hero-metrics">
              <span>{copy.upcomingTasksMetric(summary.upcomingTasksCount)}</span>
            </div>
          </>
        ) : (
          <DashboardEmpty message={copy.dailySummaryEmpty} />
        )}
      </div>

      <div className="dashboard-hero-progress dashboard-hero-secondary panel">
        <p className="dashboard-hero-progress-title">{copy.roadmapProgressTitle}</p>
        <p className="dashboard-hero-progress-value">{roadmapProgressLabel}</p>
        {hasRoadmapProgress(progress) ? (
          roadmapList.length > 1 ? (
            <div className="dashboard-roadmap-list">
              {roadmapList.map((roadmap) => (
                <div key={roadmap.id} className="dashboard-roadmap-item">
                  <div className="dashboard-roadmap-item-header">
                    <span className="dashboard-roadmap-item-title">{roadmap.title}</span>
                    <span className="dashboard-roadmap-item-stats">
                      {roadmap.completedTopics}/{roadmap.totalTopics}
                    </span>
                  </div>
                  <div className="dashboard-progress-track dashboard-progress-track--mini">
                    <span
                      className="dashboard-progress-fill"
                      style={{ width: `${roadmap.progressPercent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="dashboard-progress-track">
              <span
                className="dashboard-progress-fill"
                style={{ width: `${progress.roadmapProgressPercent}%` }}
              />
            </div>
          )
        ) : (
          <DashboardEmpty message={copy.roadmapProgressEmpty} />
        )}
      </div>
    </section>
  );
});

const TopicsInProgressPanel = memo(function TopicsInProgressPanel({
  topics,
  copy,
  locale
}: {
  topics: DashboardTopicInProgress[];
  copy: DashboardCopy;
  locale: string;
}) {
  return (
    <DashboardPanel
      title={copy.topicsInProgressTitle}
      description={copy.topicsInProgressDescription}
      href="/topics"
      copy={copy}
    >
      {topics.length === 0 ? (
        <DashboardEmpty message={copy.topicsInProgressEmpty} />
      ) : (
        <ul className="dashboard-list">
          {topics.map((topic) => (
            <li key={topic.id} className="dashboard-list-item">
              <div>
                <p className="dashboard-list-title">{topic.title}</p>
                <p className="dashboard-list-subtitle">
                  {copy.targetDate(formatDashboardDate(topic.targetDate, locale, copy.noDate))}
                </p>
              </div>
              <span className="dashboard-badge">{topic.progressPercent}%</span>
            </li>
          ))}
        </ul>
      )}
    </DashboardPanel>
  );
});

const RecentMaterialsPanel = memo(function RecentMaterialsPanel({
  materials,
  copy,
  locale
}: {
  materials: DashboardRecentMaterial[];
  copy: DashboardCopy;
  locale: string;
}) {
  return (
    <DashboardPanel
      title={copy.recentMaterialsTitle}
      description={copy.recentMaterialsDescription}
      href="/materials"
      copy={copy}
    >
      {materials.length === 0 ? (
        <DashboardEmpty message={copy.recentMaterialsEmpty} />
      ) : (
        <ul className="dashboard-list">
          {materials.map((material) => (
            <li key={material.id} className="dashboard-list-item">
              <div>
                <p className="dashboard-list-title">{material.title}</p>
                <p className="dashboard-list-subtitle">
                  {copy.openedAt(material.topicTitle, formatDashboardDate(material.lastOpenedAt, locale, copy.noDate))}
                </p>
              </div>
              <span className="dashboard-badge">{material.progressPercent}%</span>
            </li>
          ))}
        </ul>
      )}
    </DashboardPanel>
  );
});

const UpcomingTasksPanel = memo(function UpcomingTasksPanel({
  tasks,
  copy,
  locale
}: {
  tasks: DashboardTask[];
  copy: DashboardCopy;
  locale: string;
}) {
  return (
    <DashboardPanel
      title={copy.upcomingTasksTitle}
      description={copy.upcomingTasksDescription}
      href="/tasks"
      copy={copy}
    >
      {tasks.length === 0 ? (
        <DashboardEmpty message={copy.upcomingTasksEmpty} />
      ) : (
        <ul className="dashboard-list">
          {tasks.map((task) => (
            <li key={task.id} className="dashboard-list-item">
              <div>
                <p className="dashboard-list-title">{task.title}</p>
                <p className="dashboard-list-subtitle">
                  {copy.dueAt(task.topicTitle ?? copy.noTopic, formatDashboardDate(task.dueAt, locale, copy.noDate))}
                </p>
              </div>
              {isDashboardTaskOverdue(task.dueAt) ? (
                <span className="dashboard-badge dashboard-badge-overdue">{copy.overdue}</span>
              ) : (
                <span className="dashboard-badge">{copy.planned}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </DashboardPanel>
  );
});

const DashboardHistoryPanel = memo(function DashboardHistoryPanel({
  history,
  copy,
  language,
  locale
}: {
  history: DashboardHistoryEvent[];
  copy: DashboardCopy;
  language: "ru" | "en";
  locale: string;
}) {
  return (
    <DashboardPanel
      title={copy.historyTitle}
      description={copy.historyDescription}
      href="/dashboard/history"
      copy={copy}
    >
      {history.length === 0 ? (
        <DashboardEmpty message={copy.historyEmpty} />
      ) : (
        <ul className="dashboard-list">
          {history.map((entry) => (
            <li key={entry.id} className="dashboard-list-item">
              <div>
                <p className="dashboard-list-title">{formatHistoryEventTitle(entry, language)}</p>
                <p className="dashboard-list-subtitle">
                  {formatHistoryEventSubtitle(
                    entry,
                    language,
                    formatDashboardDate(entry.createdAt, locale, copy.noDate)
                  )}
                </p>
              </div>
              <span className="dashboard-badge">{formatHistoryEventBadge(entry, language)}</span>
            </li>
          ))}
        </ul>
      )}
    </DashboardPanel>
  );
});

const DashboardReviewBanner = memo(function DashboardReviewBanner({
  copy,
  language
}: {
  copy: DashboardCopy;
  language: "ru" | "en";
}) {
  const router = useRouter();
  const momentumCopy = MOMENTUM_COPY[language];

  return (
    <section className="panel dashboard-review-banner">
      <div className="dashboard-review-copy">
        <button type="button" className="button" onClick={() => router.push("/weekly-review")}>
          {copy.weeklyReviewCTA}
        </button>
        <span className="dashboard-review-note">{momentumCopy.weeklyReviewNote}</span>
      </div>
    </section>
  );
});

function DashboardLoadingState() {
  return (
    <div className="dashboard-view">
      <section className="dashboard-personal">
        <DashboardLoading lines={2} />
      </section>
      <section className="dashboard-hero">
        <section className="panel">
          <DashboardLoading lines={5} />
        </section>
        <section className="panel">
          <DashboardLoading lines={4} />
        </section>
      </section>
      <section className="panel">
        <DashboardLoading lines={6} />
      </section>
    </div>
  );
}

export function DashboardView() {
  const queryClient = useQueryClient();
  const { dashboardCopy, language, locale, overviewQuery, roadmapProgressLabel, greetingLabel, todayLabel } =
    useDashboardViewModel();

  if (overviewQuery.isPending) {
    return <DashboardLoadingState />;
  }

  if (overviewQuery.isError || !overviewQuery.data) {
    return (
      <section className="panel">
        <DashboardError
          message={overviewQuery.error instanceof Error ? overviewQuery.error.message : dashboardCopy.blockLoadFailed}
          onRetry={() => {
            void overviewQuery.refetch();
          }}
          retryLabel={dashboardCopy.retry}
        />
      </section>
    );
  }

  const overview = overviewQuery.data;

  return (
    <div className="dashboard-view">
      <section className="dashboard-personal">
        <h2 className="dashboard-personal-title">{greetingLabel}</h2>
        <p className="dashboard-personal-date">{todayLabel}</p>
      </section>

      <DashboardCalendarRibbon locale={locale} />

      <section className="dashboard-hero">
        <DashboardFocusSection
          focus={overview.focus}
          copy={dashboardCopy}
          todayLabel={todayLabel}
          onMarkDone={async (taskId) => {
            await authFetch(`/api/tasks/${encodeURIComponent(taskId)}/status`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "done" })
            });
            await queryClient.invalidateQueries({ queryKey: DASHBOARD_OVERVIEW_QUERY_KEY });
          }}
        />
        <DashboardMomentumSection
          progress={overview.progress}
          roadmapCount={overview.roadmapList.length}
          roadmapProgressLabel={roadmapProgressLabel}
          copy={dashboardCopy}
          language={language}
        />
      </section>

      <ActivityHeatmap data={overview.heatmap} />

      <DashboardChartsSection copy={dashboardCopy} locale={locale} charts={overview.charts} />

      <DashboardSnapshotSection
        summary={overview.dailySummary}
        roadmapList={overview.roadmapList}
        progress={overview.progress}
        roadmapProgressLabel={roadmapProgressLabel}
        copy={dashboardCopy}
      />

      <div className="dashboard-grid">
        <div className="dashboard-grid-main">
          <TopicsInProgressPanel topics={overview.topicsInProgress} copy={dashboardCopy} locale={locale} />
          <RecentMaterialsPanel materials={overview.recentMaterials} copy={dashboardCopy} locale={locale} />
        </div>

        <div className="dashboard-grid-side">
          <UpcomingTasksPanel tasks={overview.upcomingTasks} copy={dashboardCopy} locale={locale} />
          <DashboardHistoryPanel
            history={overview.history}
            copy={dashboardCopy}
            language={language}
            locale={locale}
          />
        </div>
      </div>

      <DashboardReviewBanner copy={dashboardCopy} language={language} />
    </div>
  );
}

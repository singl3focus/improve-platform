"use client";

import { KeyboardEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  formatDashboardDate,
  hasDailySummaryContent,
  hasRoadmapProgress,
  isDashboardTaskOverdue,
  useDashboardViewModel
} from "@features/dashboard/hooks/use-dashboard-view-model";
import type { DashboardChartsPayload } from "@features/dashboard/types";
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
    activePlans: "Активных карт",
    weeklyReviewNote: "Пять минут на разбор недели и следующего шага."
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
      <button
        type="button"
        className="button button-outline dashboard-retry"
        onClick={(event) => {
          event.stopPropagation();
          onRetry();
        }}
      >
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

function DashboardCharts({
  copy,
  locale,
  charts,
  onRetry
}: {
  copy: DashboardCopy;
  locale: string;
  charts: DashboardChartsPayload;
  onRetry: () => void;
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
      <button type="button" className="button button-outline dashboard-chart-retry" onClick={onRetry}>
        {copy.retry}
      </button>
    </section>
  );
}

function focusPriorityLabel(level: string, copy: DashboardCopy): string {
  switch (level) {
    case "overdue":
      return copy.focusPriorityOverdue;
    case "due_today":
      return copy.focusPriorityToday;
    case "in_progress":
      return copy.focusPriorityActive;
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

export function DashboardView() {
  const router = useRouter();
  const {
    dashboardCopy,
    language,
    locale,
    focus,
    progress,
    roadmapList,
    dailySummary,
    topicsInProgress,
    upcomingTasks,
    charts,
    recentMaterials,
    history,
    roadmapProgressLabel,
    greetingLabel,
    todayLabel
  } = useDashboardViewModel();

  const momentumCopy = language === "ru" ? MOMENTUM_COPY.ru : MOMENTUM_COPY.en;
  const focusHoursValue =
    progress.state.status === "success" && progress.state.data
      ? `${progress.state.data.focusHoursCompleted}/${progress.state.data.focusHoursTarget}`
      : "—";
  const completedTopicsValue =
    progress.state.status === "success" && progress.state.data
      ? `${progress.state.data.completedTopics}/${progress.state.data.totalTopics}`
      : "—";
  const activePlansValue =
    roadmapList.state.status === "success" && roadmapList.state.data
      ? `${roadmapList.state.data.length}`
      : "—";

  function onHeroKeyDown(event: KeyboardEvent<HTMLElement>, href: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      router.push(href);
    }
  }

  return (
    <div className="dashboard-view">
      <section className="dashboard-personal">
        <h2 className="dashboard-personal-title">{greetingLabel}</h2>
        <p className="dashboard-personal-date">{todayLabel}</p>
      </section>

      <DashboardCalendarRibbon locale={locale} />

      <section className="dashboard-hero dashboard-hero-ranked">
        <section className="dashboard-focus panel dashboard-focus-panel">
          <header className="dashboard-focus-header">
            <div>
              <p className="dashboard-eyebrow">{dashboardCopy.focusToday}</p>
              <h3>{dashboardCopy.focusToday}</h3>
            </div>
            <span className="dashboard-focus-date">{todayLabel}</span>
          </header>

          {focus.state.status === "loading" ? <DashboardLoading lines={3} /> : null}
          {focus.state.status === "error" ? (
            <DashboardError
              message={focus.state.errorMessage ?? dashboardCopy.blockLoadFailed}
              onRetry={focus.reload}
              retryLabel={dashboardCopy.retry}
            />
          ) : null}
          {focus.state.status === "success" && focus.state.data ? (
            !focus.state.data.primaryTask ? (
              <div className="dashboard-empty dashboard-focus-empty">
                <p>{dashboardCopy.focusEmptyState}</p>
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => router.push("/tasks")}
                >
                  {dashboardCopy.open}
                </button>
              </div>
            ) : (
              <>
                <div className="dashboard-focus-main">
                  <div className="dashboard-focus-copy">
                    <span
                      className={`dashboard-badge ${focusPriorityClass(
                        focus.state.data.primaryTask.priorityLevel
                      )}`}
                    >
                      {focusPriorityLabel(
                        focus.state.data.primaryTask.priorityLevel,
                        dashboardCopy
                      )}
                    </span>
                    <p className="dashboard-focus-title">{focus.state.data.primaryTask.title}</p>
                    <p className="dashboard-focus-subtitle">
                      {focus.state.data.primaryTask.topicTitle ?? dashboardCopy.noTopic}
                      {" · "}
                      {focus.state.data.primaryTask.deadline
                        ? `Due: ${focus.state.data.primaryTask.deadline}`
                        : dashboardCopy.focusNoDue}
                    </p>
                  </div>

                  <div className="dashboard-focus-actions">
                    <button
                      type="button"
                      className="button button-primary"
                      onClick={async (event) => {
                        event.stopPropagation();
                        const taskId = focus.state.data?.primaryTask?.id;
                        if (!taskId) return;
                        await authFetch(`/api/tasks/${encodeURIComponent(taskId)}/status`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ status: "done" })
                        });
                        focus.reload();
                      }}
                    >
                      {dashboardCopy.focusMarkDone}
                    </button>
                    <button
                      type="button"
                      className="button button-outline"
                      onClick={() => router.push("/tasks")}
                    >
                      {dashboardCopy.open}
                    </button>
                  </div>
                </div>

                {focus.state.data.secondaryTasks.length > 0 ? (
                  <div className="dashboard-focus-support">
                    <p className="dashboard-focus-section-label">{dashboardCopy.focusAlsoToday}</p>
                    <ul className="dashboard-list dashboard-focus-list">
                      {focus.state.data.secondaryTasks.map((task) => (
                        <li key={task.id} className="dashboard-list-item">
                          <div>
                            <p className="dashboard-list-title">{task.title}</p>
                            <p className="dashboard-list-subtitle">
                              {task.topicTitle ?? dashboardCopy.noTopic}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="button button-outline dashboard-list-mini-action"
                            onClick={(event) => {
                              event.stopPropagation();
                              router.push("/tasks");
                            }}
                          >
                            →
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {focus.state.data.continueTopic ? (
                  <div className="dashboard-focus-support">
                    <p className="dashboard-focus-section-label">{dashboardCopy.focusContinue}</p>
                    <div
                      className="dashboard-list-item dashboard-focus-topic"
                      onClick={() =>
                        router.push(`/topics?topicId=${focus.state.data!.continueTopic!.id}`)
                      }
                    >
                      <div>
                        <p className="dashboard-list-title">{focus.state.data.continueTopic.title}</p>
                        <p className="dashboard-list-subtitle">
                          Last: {focus.state.data.continueTopic.lastTaskTitle}
                        </p>
                      </div>
                      <span className="dashboard-badge">
                        {focus.state.data.continueTopic.progressPercent}%
                      </span>
                    </div>
                  </div>
                ) : null}
              </>
            )
          ) : null}
        </section>

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
              <strong>{focusHoursValue}</strong>
            </article>
            <article className="dashboard-momentum-card">
              <span>{momentumCopy.roadmap}</span>
              <strong>{completedTopicsValue}</strong>
            </article>
            <article className="dashboard-momentum-card">
              <span>{momentumCopy.activePlans}</span>
              <strong>{activePlansValue}</strong>
            </article>
          </div>

          {progress.state.status === "loading" ? <DashboardLoading lines={2} /> : null}
          {progress.state.status === "error" ? (
            <DashboardError
              message={progress.state.errorMessage ?? dashboardCopy.roadmapProgressLoadFailed}
              onRetry={progress.reload}
              retryLabel={dashboardCopy.retry}
            />
          ) : null}
          {progress.state.status === "success" && progress.state.data ? (
            <div className="dashboard-momentum-progress">
              <div className="dashboard-progress-track">
                <span
                  className="dashboard-progress-fill"
                  style={{ width: `${progress.state.data.roadmapProgressPercent}%` }}
                />
              </div>
            </div>
          ) : null}
        </section>
      </section>

      <ActivityHeatmap />

      {charts.state.status === "loading" ? (
        <section className="dashboard-charts panel">
          <header className="dashboard-charts-header">
            <h3>{dashboardCopy.chartsTitle}</h3>
            <p>{dashboardCopy.chartsDescription}</p>
          </header>
          <DashboardLoading lines={6} />
        </section>
      ) : null}
      {charts.state.status === "error" ? (
        <section className="dashboard-charts panel">
          <header className="dashboard-charts-header">
            <h3>{dashboardCopy.chartsTitle}</h3>
            <p>{dashboardCopy.chartsDescription}</p>
          </header>
          <DashboardError
            message={charts.state.errorMessage ?? dashboardCopy.chartsLoadFailed}
            onRetry={charts.reload}
            retryLabel={dashboardCopy.retry}
          />
        </section>
      ) : null}
      {charts.state.status === "success" && charts.state.data ? (
        <DashboardCharts
          copy={dashboardCopy}
          locale={locale}
          charts={charts.state.data}
          onRetry={charts.reload}
        />
      ) : null}

      <section className="dashboard-hero">
        <div
          className="dashboard-hero-main dashboard-hero-clickable"
          role="link"
          tabIndex={0}
          onClick={() => router.push("/tasks?filter=today")}
          onKeyDown={(event) => onHeroKeyDown(event, "/tasks?filter=today")}
        >
          <h2>{dashboardCopy.snapshotTitle}</h2>
          {dailySummary.state.status === "loading" ? <DashboardLoading lines={2} /> : null}
          {dailySummary.state.status === "error" ? (
            <DashboardError
              message={dailySummary.state.errorMessage ?? dashboardCopy.dailySummaryLoadFailed}
              onRetry={dailySummary.reload}
              retryLabel={dashboardCopy.retry}
            />
          ) : null}
          {dailySummary.state.status === "success" && dailySummary.state.data ? (
            hasDailySummaryContent(dailySummary.state.data) ? (
              <>
                {dailySummary.state.data.nextTaskTitle ? (
                  <p className="dashboard-hero-headline">{dailySummary.state.data.nextTaskTitle}</p>
                ) : null}
                <p className="dashboard-hero-focus">
                  {dashboardCopy.upcomingTasksMetric(dailySummary.state.data.upcomingTasksCount)}
                </p>
                <div className="dashboard-hero-metrics">
                  <span>
                    {dashboardCopy.upcomingTasksMetric(dailySummary.state.data.upcomingTasksCount)}
                  </span>
                </div>
              </>
            ) : (
              <DashboardEmpty message={dashboardCopy.dailySummaryEmpty} />
            )
          ) : null}
        </div>

        <div className="dashboard-hero-progress dashboard-hero-secondary panel">
          <p className="dashboard-hero-progress-title">{dashboardCopy.roadmapProgressTitle}</p>
          <p className="dashboard-hero-progress-value">{roadmapProgressLabel}</p>
          {progress.state.status === "success" && progress.state.data ? (
            hasRoadmapProgress(progress.state.data) ? (
              roadmapList.state.status === "success" &&
              roadmapList.state.data &&
              roadmapList.state.data.length > 1 ? (
                <div className="dashboard-roadmap-list">
                  {roadmapList.state.data.map((roadmap) => (
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
                    style={{ width: `${progress.state.data.roadmapProgressPercent}%` }}
                  />
                </div>
              )
            ) : (
              <DashboardEmpty message={dashboardCopy.roadmapProgressEmpty} />
            )
          ) : null}
        </div>
      </section>

      <div className="dashboard-grid">
        <div className="dashboard-grid-main">
          <DashboardPanel
            title={dashboardCopy.topicsInProgressTitle}
            description={dashboardCopy.topicsInProgressDescription}
            href="/topics"
            copy={dashboardCopy}
          >
            {topicsInProgress.state.status === "loading" ? <DashboardLoading /> : null}
            {topicsInProgress.state.status === "error" ? (
              <DashboardError
                message={topicsInProgress.state.errorMessage ?? dashboardCopy.topicsInProgressLoadFailed}
                onRetry={topicsInProgress.reload}
                retryLabel={dashboardCopy.retry}
              />
            ) : null}
            {topicsInProgress.state.status === "success" && topicsInProgress.state.data ? (
              topicsInProgress.state.data.length === 0 ? (
                <DashboardEmpty message={dashboardCopy.topicsInProgressEmpty} />
              ) : (
                <ul className="dashboard-list">
                  {topicsInProgress.state.data.map((topic) => (
                    <li key={topic.id} className="dashboard-list-item">
                      <div>
                        <p className="dashboard-list-title">{topic.title}</p>
                        <p className="dashboard-list-subtitle">
                          {dashboardCopy.targetDate(
                            formatDashboardDate(topic.targetDate, locale, dashboardCopy.noDate)
                          )}
                        </p>
                      </div>
                      <span className="dashboard-badge">{topic.progressPercent}%</span>
                    </li>
                  ))}
                </ul>
              )
            ) : null}
          </DashboardPanel>

          <DashboardPanel
            title={dashboardCopy.recentMaterialsTitle}
            description={dashboardCopy.recentMaterialsDescription}
            href="/materials"
            copy={dashboardCopy}
          >
            {recentMaterials.state.status === "loading" ? <DashboardLoading /> : null}
            {recentMaterials.state.status === "error" ? (
              <DashboardError
                message={recentMaterials.state.errorMessage ?? dashboardCopy.recentMaterialsLoadFailed}
                onRetry={recentMaterials.reload}
                retryLabel={dashboardCopy.retry}
              />
            ) : null}
            {recentMaterials.state.status === "success" && recentMaterials.state.data ? (
              recentMaterials.state.data.length === 0 ? (
                <DashboardEmpty message={dashboardCopy.recentMaterialsEmpty} />
              ) : (
                <ul className="dashboard-list">
                  {recentMaterials.state.data.map((material) => (
                    <li key={material.id} className="dashboard-list-item">
                      <div>
                        <p className="dashboard-list-title">{material.title}</p>
                        <p className="dashboard-list-subtitle">
                          {dashboardCopy.openedAt(
                            material.topicTitle,
                            formatDashboardDate(
                              material.lastOpenedAt,
                              locale,
                              dashboardCopy.noDate
                            )
                          )}
                        </p>
                      </div>
                      <span className="dashboard-badge">{material.progressPercent}%</span>
                    </li>
                  ))}
                </ul>
              )
            ) : null}
          </DashboardPanel>
        </div>

        <div className="dashboard-grid-side">
          <DashboardPanel
            title={dashboardCopy.upcomingTasksTitle}
            description={dashboardCopy.upcomingTasksDescription}
            href="/tasks"
            copy={dashboardCopy}
          >
            {upcomingTasks.state.status === "loading" ? <DashboardLoading /> : null}
            {upcomingTasks.state.status === "error" ? (
              <DashboardError
                message={upcomingTasks.state.errorMessage ?? dashboardCopy.upcomingTasksLoadFailed}
                onRetry={upcomingTasks.reload}
                retryLabel={dashboardCopy.retry}
              />
            ) : null}
            {upcomingTasks.state.status === "success" && upcomingTasks.state.data ? (
              upcomingTasks.state.data.length === 0 ? (
                <DashboardEmpty message={dashboardCopy.upcomingTasksEmpty} />
              ) : (
                <ul className="dashboard-list">
                  {upcomingTasks.state.data.map((task) => (
                    <li key={task.id} className="dashboard-list-item">
                      <div>
                        <p className="dashboard-list-title">{task.title}</p>
                        <p className="dashboard-list-subtitle">
                          {dashboardCopy.dueAt(
                            task.topicTitle ?? dashboardCopy.noTopic,
                            formatDashboardDate(task.dueAt, locale, dashboardCopy.noDate)
                          )}
                        </p>
                      </div>
                      {isDashboardTaskOverdue(task.dueAt) ? (
                        <span className="dashboard-badge dashboard-badge-overdue">
                          {dashboardCopy.overdue}
                        </span>
                      ) : (
                        <span className="dashboard-badge">{dashboardCopy.planned}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )
            ) : null}
          </DashboardPanel>

          <DashboardPanel
            title={dashboardCopy.historyTitle}
            description={dashboardCopy.historyDescription}
            href="/dashboard/history"
            copy={dashboardCopy}
          >
            {history.state.status === "loading" ? <DashboardLoading /> : null}
            {history.state.status === "error" ? (
              <DashboardError
                message={history.state.errorMessage ?? dashboardCopy.historyLoadFailed}
                onRetry={history.reload}
                retryLabel={dashboardCopy.retry}
              />
            ) : null}
            {history.state.status === "success" && history.state.data ? (
              history.state.data.length === 0 ? (
                <DashboardEmpty message={dashboardCopy.historyEmpty} />
              ) : (
                <ul className="dashboard-list">
                  {history.state.data.map((entry) => (
                    <li key={entry.id} className="dashboard-list-item">
                      <div>
                        <p className="dashboard-list-title">
                          {formatHistoryEventTitle(entry, language)}
                        </p>
                        <p className="dashboard-list-subtitle">
                          {formatHistoryEventSubtitle(
                            entry,
                            language,
                            formatDashboardDate(entry.createdAt, locale, dashboardCopy.noDate)
                          )}
                        </p>
                      </div>
                      <span className="dashboard-badge">
                        {formatHistoryEventBadge(entry, language)}
                      </span>
                    </li>
                  ))}
                </ul>
              )
            ) : null}
          </DashboardPanel>
        </div>
      </div>

      <section className="panel dashboard-review-banner">
        <div className="dashboard-review-copy">
          <button type="button" className="button" onClick={() => router.push("/weekly-review")}>
            {dashboardCopy.weeklyReviewCTA}
          </button>
          <span className="dashboard-review-note">{momentumCopy.weeklyReviewNote}</span>
        </div>
      </section>
    </div>
  );
}

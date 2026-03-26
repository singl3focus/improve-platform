"use client";

import { KeyboardEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  formatDashboardDate,
  hasDailySummaryContent,
  hasRoadmapProgress,
  isDashboardTaskOverdue,
  useDashboardViewModel
} from "@/components/hooks/use-dashboard-view-model";
import type { DashboardChartsPayload, DashboardHistoryEvent } from "@/lib/dashboard-types";
import type { DashboardCopy } from "@/lib/ui-copy";
import { DashboardCalendarRibbon } from "@/components/dashboard-calendar-ribbon";

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

function formatHistorySubtitle(entry: DashboardHistoryEvent, locale: string, copy: DashboardCopy): string {
  return `${entry.entityType} · ${entry.eventType} · ${formatDashboardDate(entry.createdAt, locale, copy.noDate)}`;
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
              {topicsByStatusItems.map((item) => (
                <li key={item.label} className="dashboard-chart-list-item">
                  <span>{item.label}</span>
                  <div className="dashboard-chart-bar-track" aria-hidden="true">
                    <span
                      className={`dashboard-chart-bar-fill ${item.className}`}
                      style={{ width: `${Math.round((item.value / topicsByStatusMax) * 100)}%` }}
                    />
                  </div>
                  <strong>{copy.chartCountLabel(item.value)}</strong>
                </li>
              ))}
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

export function DashboardView() {
  const router = useRouter();
  const {
    dashboardCopy,
    locale,
    progress,
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

        <div
          className="dashboard-hero-progress dashboard-hero-clickable"
          role="link"
          tabIndex={0}
          onClick={() => router.push("/roadmap")}
          onKeyDown={(event) => onHeroKeyDown(event, "/roadmap")}
        >
          <p className="dashboard-hero-progress-title">{dashboardCopy.roadmapProgressTitle}</p>
          <p className="dashboard-hero-progress-value">{roadmapProgressLabel}</p>
          {progress.state.status === "loading" ? <DashboardLoading lines={1} /> : null}
          {progress.state.status === "error" ? (
            <DashboardError
              message={progress.state.errorMessage ?? dashboardCopy.roadmapProgressLoadFailed}
              onRetry={progress.reload}
              retryLabel={dashboardCopy.retry}
            />
          ) : null}
          {progress.state.status === "success" && progress.state.data ? (
            hasRoadmapProgress(progress.state.data) ? (
              <div className="dashboard-progress-track">
                <span
                  className="dashboard-progress-fill"
                  style={{ width: `${progress.state.data.roadmapProgressPercent}%` }}
                />
              </div>
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
                            formatDashboardDate(material.lastOpenedAt, locale, dashboardCopy.noDate)
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
                        <p className="dashboard-list-title">{entry.eventName}</p>
                        <p className="dashboard-list-subtitle">
                          {formatHistorySubtitle(entry, locale, dashboardCopy)}
                        </p>
                      </div>
                      <span className="dashboard-badge">{entry.eventType}</span>
                    </li>
                  ))}
                </ul>
              )
            ) : null}
          </DashboardPanel>
        </div>
      </div>
    </div>
  );
}

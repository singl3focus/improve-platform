"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWeeklyReviewViewModel } from "@features/weekly-review/hooks/use-weekly-review-view-model";
import type { WeeklyReviewTask, WeeklyReviewTopic } from "@features/weekly-review/types";
import { useUserPreferences } from "@shared/providers/user-preferences-provider";

type Step = 1 | 2 | 3;

function formatDate(value: string | null, locale: string, fallback: string) {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function ReviewStepButton({
  active,
  label,
  onClick
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`weekly-review-step-button${active ? " weekly-review-step-button-active" : ""}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function StuckTaskCard({
  task,
  locale,
  noTopicLabel,
  noDateLabel,
  rescheduleLabel,
  pauseLabel,
  onReschedule,
  onPause
}: {
  task: WeeklyReviewTask;
  locale: string;
  noTopicLabel: string;
  noDateLabel: string;
  rescheduleLabel: string;
  pauseLabel: string;
  onReschedule: (id: string, title: string, date: string) => Promise<void>;
  onPause: (id: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  async function handleReschedule(date: string) {
    setBusy(true);
    try {
      await onReschedule(task.id, task.title, date);
    } finally {
      setBusy(false);
    }
  }

  async function handlePause() {
    setBusy(true);
    try {
      await onPause(task.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="weekly-review-stuck-card">
      <div>
        <p className="dashboard-list-title">{task.title}</p>
        <p className="dashboard-list-subtitle">
          {task.topicTitle ?? noTopicLabel} · {formatDate(task.deadline, locale, noDateLabel)}
        </p>
      </div>
      <div className="weekly-review-stuck-actions">
        <label className="weekly-review-date-field">
          <span>{rescheduleLabel}</span>
          <input
            type="date"
            className="input"
            disabled={busy}
            onChange={(event) => {
              if (event.target.value) void handleReschedule(event.target.value);
            }}
          />
        </label>
        <button type="button" className="button button-outline" disabled={busy} onClick={handlePause}>
          {pauseLabel}
        </button>
      </div>
    </li>
  );
}

function StuckTopicCard({
  topic,
  locale,
  noDateLabel,
  rescheduleLabel,
  pauseLabel,
  onReschedule,
  onPause
}: {
  topic: WeeklyReviewTopic;
  locale: string;
  noDateLabel: string;
  rescheduleLabel: string;
  pauseLabel: string;
  onReschedule: (id: string, title: string, date: string) => Promise<void>;
  onPause: (id: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  async function handleReschedule(date: string) {
    setBusy(true);
    try {
      await onReschedule(topic.id, topic.title, date);
    } finally {
      setBusy(false);
    }
  }

  async function handlePause() {
    setBusy(true);
    try {
      await onPause(topic.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="weekly-review-stuck-card">
      <div>
        <p className="dashboard-list-title">{topic.title}</p>
        <p className="dashboard-list-subtitle">
          {topic.progressPercent}% · {formatDate(topic.targetDate, locale, noDateLabel)}
        </p>
      </div>
      <div className="weekly-review-stuck-actions">
        <label className="weekly-review-date-field">
          <span>{rescheduleLabel}</span>
          <input
            type="date"
            className="input"
            disabled={busy}
            onChange={(event) => {
              if (event.target.value) void handleReschedule(event.target.value);
            }}
          />
        </label>
        <button type="button" className="button button-outline" disabled={busy} onClick={handlePause}>
          {pauseLabel}
        </button>
      </div>
    </li>
  );
}

export function WeeklyReviewView() {
  const router = useRouter();
  const { language } = useUserPreferences();
  const {
    dashboardCopy: copy,
    data,
    loading,
    error,
    step,
    setStep,
    reflectionNote,
    setReflectionNote,
    nextWeekGoal,
    setNextWeekGoal,
    submitting,
    submitReview,
    rescheduleTask,
    pauseTask,
    pauseTopic,
    rescheduleTopic
  } = useWeeklyReviewViewModel();

  const locale = language === "ru" ? "ru-RU" : "en-US";
  const ui =
    language === "ru"
      ? {
          eyebrow: "Ретроспектива недели",
          lead: "Соберите неделю в один рабочий ритуал: что завершено, что буксует и куда двигаемся дальше.",
          completedTasks: "Завершённые задачи",
          completedTopics: "Завершённые темы",
          roadmapDelta: "Сдвиг по roadmap",
          noDate: "Без даты",
          noTopic: "Без темы",
          reschedule: "Новая дата",
          pause: "Пауза",
          stuckTasks: "Застрявшие задачи",
          stuckTopics: "Застрявшие темы",
          activeTopics: "Активные темы",
          upcomingTasks: "Ближайшие задачи",
          submitLoading: "Сохранение...",
          backLabel: "Вернуться к dashboard"
        }
      : {
          eyebrow: "Week review ritual",
          lead: "Collect the week into one operating ritual: what got finished, what got stuck, and where you move next.",
          completedTasks: "Completed tasks",
          completedTopics: "Completed topics",
          roadmapDelta: "Roadmap delta",
          noDate: "No date",
          noTopic: "No topic",
          reschedule: "New date",
          pause: "Pause",
          stuckTasks: "Stuck tasks",
          stuckTopics: "Stuck topics",
          activeTopics: "Active topics",
          upcomingTasks: "Upcoming tasks",
          submitLoading: "Saving...",
          backLabel: "Back to dashboard"
        };

  if (loading) {
    return (
      <section className="weekly-review-view">
        <section className="panel weekly-review-loading-panel">
          <p>{copy.loading}</p>
          <div className="dashboard-loading" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </section>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="weekly-review-view">
        <section className="panel weekly-review-loading-panel">
          <div className="dashboard-error">
            <p>{error ?? copy.blockLoadFailed}</p>
          </div>
        </section>
      </section>
    );
  }

  const progressDelta = data.progressNow - data.progressBefore;
  const hasStuckItems = data.stuckTasks.length > 0 || data.stuckTopics.length > 0;

  return (
    <section className="weekly-review-view">
      <section className="panel weekly-review-hero">
        <div className="weekly-review-hero-copy">
          <p className="dashboard-eyebrow">{ui.eyebrow}</p>
          <h2>{copy.weeklyReviewTitle}</h2>
          <p>{ui.lead}</p>
        </div>
        <div className="weekly-review-period-card">
          <span>{copy.today(formatDate(data.periodEnd, locale, ui.noDate))}</span>
          <strong>
            {formatDate(data.periodStart, locale, ui.noDate)} - {formatDate(data.periodEnd, locale, ui.noDate)}
          </strong>
        </div>
      </section>

      <div className="weekly-review-steps">
        {[1, 2, 3].map((item) => (
          <ReviewStepButton
            key={item}
            active={step === (item as Step)}
            label={
              item === 1 ? copy.weeklyReviewStep1 : item === 2 ? copy.weeklyReviewStep2 : copy.weeklyReviewStep3
            }
            onClick={() => setStep(item as Step)}
          />
        ))}
      </div>

      {step === 1 ? (
        <div className="weekly-review-grid">
          <section className="panel weekly-review-summary-card">
            <p className="topic-card-kicker">{copy.weeklyReviewStep1}</p>
            <h3>{copy.weeklyReviewStep1}</h3>
            <div className="weekly-review-metrics">
              <article className="weekly-review-metric-card">
                <span>{ui.completedTasks}</span>
                <strong>{data.completedTasks.length}</strong>
              </article>
              <article className="weekly-review-metric-card">
                <span>{ui.completedTopics}</span>
                <strong>{data.completedTopics.length}</strong>
              </article>
              <article className="weekly-review-metric-card">
                <span>{ui.roadmapDelta}</span>
                <strong>{progressDelta > 0 ? `+${progressDelta}%` : `${progressDelta}%`}</strong>
              </article>
            </div>
            <div className="weekly-review-progress-block">
              <div className="weekly-review-progress-copy">
                <span>{ui.roadmapDelta}</span>
                <strong>
                  {data.progressBefore}% {"->"} {data.progressNow}%
                </strong>
              </div>
              <div className="dashboard-progress-track">
                <span className="dashboard-progress-fill" style={{ width: `${data.progressNow}%` }} />
              </div>
            </div>
          </section>

          <section className="panel weekly-review-reflection-card">
            <p className="topic-card-kicker">{copy.weeklyReviewReflection}</p>
            <h3>{copy.weeklyReviewReflection}</h3>
            <textarea
              rows={5}
              className="input weekly-review-textarea"
              value={reflectionNote}
              onChange={(event) => setReflectionNote(event.target.value)}
            />
            <button type="button" className="button button-primary" onClick={() => setStep(2)}>
              {copy.weeklyReviewStep2}
            </button>
          </section>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="weekly-review-grid">
          <section className="panel weekly-review-stuck-panel">
            <p className="topic-card-kicker">{copy.weeklyReviewStep2}</p>
            <h3>{copy.weeklyReviewStep2}</h3>

            {!hasStuckItems ? <p className="dashboard-empty">{copy.weeklyReviewNothingStuck}</p> : null}

            {data.stuckTasks.length > 0 ? (
              <div className="weekly-review-section-block">
                <h4>{ui.stuckTasks}</h4>
                <ul className="weekly-review-stuck-list">
                  {data.stuckTasks.map((task) => (
                    <StuckTaskCard
                      key={task.id}
                      task={task}
                      locale={locale}
                      noTopicLabel={ui.noTopic}
                      noDateLabel={ui.noDate}
                      rescheduleLabel={ui.reschedule}
                      pauseLabel={ui.pause}
                      onReschedule={rescheduleTask}
                      onPause={pauseTask}
                    />
                  ))}
                </ul>
              </div>
            ) : null}

            {data.stuckTopics.length > 0 ? (
              <div className="weekly-review-section-block">
                <h4>{ui.stuckTopics}</h4>
                <ul className="weekly-review-stuck-list">
                  {data.stuckTopics.map((topic) => (
                    <StuckTopicCard
                      key={topic.id}
                      topic={topic}
                      locale={locale}
                      noDateLabel={ui.noDate}
                      rescheduleLabel={ui.reschedule}
                      pauseLabel={ui.pause}
                      onReschedule={rescheduleTopic}
                      onPause={pauseTopic}
                    />
                  ))}
                </ul>
              </div>
            ) : null}

            <button type="button" className="button button-primary" onClick={() => setStep(3)}>
              {copy.weeklyReviewStep3}
            </button>
          </section>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="weekly-review-grid">
          <section className="panel weekly-review-plan-panel">
            <p className="topic-card-kicker">{copy.weeklyReviewStep3}</p>
            <h3>{copy.weeklyReviewStep3}</h3>

            {data.activeTopics.length > 0 ? (
              <div className="weekly-review-section-block">
                <h4>{ui.activeTopics}</h4>
                <ul className="weekly-review-focus-list">
                  {data.activeTopics.map((topic) => (
                    <li key={topic.id} className="weekly-review-focus-item">
                      <div>
                        <p className="dashboard-list-title">{topic.title}</p>
                        <div className="dashboard-progress-track weekly-review-mini-track">
                          <span className="dashboard-progress-fill" style={{ width: `${topic.progressPercent}%` }} />
                        </div>
                      </div>
                      <span className="dashboard-badge">{topic.progressPercent}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {data.upcomingTasks.length > 0 ? (
              <div className="weekly-review-section-block">
                <h4>{ui.upcomingTasks}</h4>
                <ul className="weekly-review-focus-list">
                  {data.upcomingTasks.map((task) => (
                    <li key={task.id} className="weekly-review-focus-item">
                      <div>
                        <p className="dashboard-list-title">{task.title}</p>
                        <p className="dashboard-list-subtitle">
                          {formatDate(task.deadline, locale, ui.noDate)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          <section className="panel weekly-review-goal-panel">
            <p className="topic-card-kicker">{copy.weeklyReviewNextGoal}</p>
            <h3>{copy.weeklyReviewNextGoal}</h3>
            <textarea
              rows={5}
              className="input weekly-review-textarea"
              value={nextWeekGoal}
              onChange={(event) => setNextWeekGoal(event.target.value)}
            />
            <div className="weekly-review-submit-row">
              <button
                type="button"
                className="button button-primary"
                disabled={submitting}
                onClick={async () => {
                  const ok = await submitReview();
                  if (ok) router.push("/dashboard");
                }}
              >
                {submitting ? ui.submitLoading : copy.weeklyReviewComplete}
              </button>
              <button type="button" className="button button-outline" onClick={() => router.push("/dashboard")}>
                {ui.backLabel}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

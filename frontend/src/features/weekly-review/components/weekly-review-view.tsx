"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWeeklyReviewViewModel } from "@features/weekly-review/hooks/use-weekly-review-view-model";
import type { WeeklyReviewTask, WeeklyReviewTopic } from "@features/weekly-review/types";

function StuckTaskCard({
  task,
  onReschedule,
  onPause
}: {
  task: WeeklyReviewTask;
  onReschedule: (id: string, title: string, date: string) => Promise<void>;
  onPause: (id: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  async function handleReschedule(date: string) {
    setBusy(true);
    try { await onReschedule(task.id, task.title, date); } finally { setBusy(false); }
  }

  async function handlePause() {
    setBusy(true);
    try { await onPause(task.id); } finally { setBusy(false); }
  }

  return (
    <li className="dashboard-list-item" style={{ flexDirection: "column", alignItems: "stretch", gap: "0.5rem" }}>
      <div>
        <p className="dashboard-list-title">{task.title}</p>
        <p className="dashboard-list-subtitle">
          {task.topicTitle ?? "No topic"} · was due {task.deadline ?? "—"}
        </p>
      </div>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <input
          type="date"
          disabled={busy}
          onChange={(e) => { if (e.target.value) void handleReschedule(e.target.value); }}
          style={{ fontSize: "0.8rem" }}
        />
        <button type="button" className="button button-outline" disabled={busy} onClick={handlePause}
          style={{ fontSize: "0.8rem", padding: "0.25rem 0.5rem" }}>
          Pause
        </button>
      </div>
    </li>
  );
}

function StuckTopicCard({
  topic,
  onReschedule,
  onPause
}: {
  topic: WeeklyReviewTopic;
  onReschedule: (id: string, title: string, date: string) => Promise<void>;
  onPause: (id: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  async function handleReschedule(date: string) {
    setBusy(true);
    try { await onReschedule(topic.id, topic.title, date); } finally { setBusy(false); }
  }

  async function handlePause() {
    setBusy(true);
    try { await onPause(topic.id); } finally { setBusy(false); }
  }

  return (
    <li className="dashboard-list-item" style={{ flexDirection: "column", alignItems: "stretch", gap: "0.5rem" }}>
      <div>
        <p className="dashboard-list-title">{topic.title}</p>
        <p className="dashboard-list-subtitle">
          {topic.progressPercent}% · was target {topic.targetDate ?? "—"}
        </p>
      </div>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <input
          type="date"
          disabled={busy}
          onChange={(e) => { if (e.target.value) void handleReschedule(e.target.value); }}
          style={{ fontSize: "0.8rem" }}
        />
        <button type="button" className="button button-outline" disabled={busy} onClick={handlePause}
          style={{ fontSize: "0.8rem", padding: "0.25rem 0.5rem" }}>
          Pause
        </button>
      </div>
    </li>
  );
}

export function WeeklyReviewView() {
  const router = useRouter();
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

  if (loading) {
    return (
      <div className="dashboard-view" style={{ padding: "2rem" }}>
        <p>{copy.loading}</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="dashboard-view" style={{ padding: "2rem" }}>
        <p>{error ?? copy.blockLoadFailed}</p>
      </div>
    );
  }

  const progressDelta = data.progressNow - data.progressBefore;
  const hasStuckItems = data.stuckTasks.length > 0 || data.stuckTopics.length > 0;

  return (
    <div className="dashboard-view" style={{ padding: "2rem", maxWidth: "720px", margin: "0 auto" }}>
      <h2 style={{ marginBottom: "0.25rem" }}>{copy.weeklyReviewTitle}</h2>
      <p style={{ color: "var(--color-text-muted)", marginBottom: "1.5rem" }}>
        {data.periodStart} — {data.periodEnd}
      </p>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
        {([1, 2, 3] as const).map((s) => (
          <button
            key={s}
            type="button"
            className={`button ${step === s ? "" : "button-outline"}`}
            style={{ fontSize: "0.85rem" }}
            onClick={() => setStep(s)}
          >
            {s === 1 ? copy.weeklyReviewStep1 : s === 2 ? copy.weeklyReviewStep2 : copy.weeklyReviewStep3}
          </button>
        ))}
      </div>

      {step === 1 && (
        <section>
          <div className="panel" style={{ padding: "1rem", marginBottom: "1rem" }}>
            <h3 style={{ marginBottom: "0.5rem" }}>{copy.weeklyReviewStep1}</h3>
            <p>
              {data.completedTasks.length} tasks done
              {data.completedTopics.length > 0 && (
                <> · Topics completed: {data.completedTopics.map((t) => t.title).join(", ")}</>
              )}
            </p>
            <div style={{ marginTop: "0.75rem" }}>
              <p style={{ fontSize: "0.9rem", color: "var(--color-text-muted)" }}>
                Roadmap progress: {data.progressBefore}% → {data.progressNow}%
                {progressDelta > 0 ? ` (+${progressDelta}%)` : ""}
              </p>
              <div className="dashboard-progress-track" style={{ marginTop: "0.25rem" }}>
                <span className="dashboard-progress-fill" style={{ width: `${data.progressNow}%` }} />
              </div>
            </div>
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontWeight: 500, marginBottom: "0.25rem" }}>
              {copy.weeklyReviewReflection}
            </label>
            <textarea
              rows={3}
              className="input"
              style={{ width: "100%" }}
              value={reflectionNote}
              onChange={(e) => setReflectionNote(e.target.value)}
            />
          </div>

          <button type="button" className="button" onClick={() => setStep(2)}>
            {copy.weeklyReviewStep2} →
          </button>
        </section>
      )}

      {step === 2 && (
        <section>
          <h3 style={{ marginBottom: "0.75rem" }}>{copy.weeklyReviewStep2}</h3>

          {!hasStuckItems ? (
            <p className="dashboard-empty" style={{ marginBottom: "1rem" }}>{copy.weeklyReviewNothingStuck}</p>
          ) : (
            <>
              {data.stuckTasks.length > 0 && (
                <div style={{ marginBottom: "1rem" }}>
                  <h4 style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>Stuck tasks</h4>
                  <ul className="dashboard-list">
                    {data.stuckTasks.map((task) => (
                      <StuckTaskCard key={task.id} task={task} onReschedule={rescheduleTask} onPause={pauseTask} />
                    ))}
                  </ul>
                </div>
              )}
              {data.stuckTopics.length > 0 && (
                <div style={{ marginBottom: "1rem" }}>
                  <h4 style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>Stuck topics</h4>
                  <ul className="dashboard-list">
                    {data.stuckTopics.map((topic) => (
                      <StuckTopicCard key={topic.id} topic={topic} onReschedule={rescheduleTopic} onPause={pauseTopic} />
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          <button type="button" className="button" onClick={() => setStep(3)}>
            {copy.weeklyReviewStep3} →
          </button>
        </section>
      )}

      {step === 3 && (
        <section>
          <h3 style={{ marginBottom: "0.75rem" }}>{copy.weeklyReviewStep3}</h3>

          {data.activeTopics.length > 0 && (
            <div style={{ marginBottom: "1rem" }}>
              <h4 style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>Active topics</h4>
              <ul className="dashboard-list">
                {data.activeTopics.map((topic) => (
                  <li key={topic.id} className="dashboard-list-item">
                    <div style={{ flex: 1 }}>
                      <p className="dashboard-list-title">{topic.title}</p>
                      <div className="dashboard-progress-track" style={{ marginTop: "0.25rem" }}>
                        <span className="dashboard-progress-fill" style={{ width: `${topic.progressPercent}%` }} />
                      </div>
                    </div>
                    <span className="dashboard-badge">{topic.progressPercent}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.upcomingTasks.length > 0 && (
            <div style={{ marginBottom: "1rem" }}>
              <h4 style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>Upcoming tasks</h4>
              <ul className="dashboard-list">
                {data.upcomingTasks.map((task) => (
                  <li key={task.id} className="dashboard-list-item">
                    <div>
                      <p className="dashboard-list-title">{task.title}</p>
                      <p className="dashboard-list-subtitle">{task.deadline ?? "No deadline"}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontWeight: 500, marginBottom: "0.25rem" }}>
              {copy.weeklyReviewNextGoal}
            </label>
            <textarea
              rows={2}
              className="input"
              style={{ width: "100%" }}
              value={nextWeekGoal}
              onChange={(e) => setNextWeekGoal(e.target.value)}
            />
          </div>

          <button
            type="button"
            className="button"
            disabled={submitting}
            onClick={async () => {
              const ok = await submitReview();
              if (ok) router.push("/dashboard");
            }}
          >
            {submitting ? copy.loading : copy.weeklyReviewComplete}
          </button>
        </section>
      )}
    </div>
  );
}

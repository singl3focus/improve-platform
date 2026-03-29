-- Daily plans: one row per user per day
CREATE TABLE daily_plans (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date        DATE NOT NULL DEFAULT CURRENT_DATE,
    reflection  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, date)
);
CREATE INDEX idx_daily_plans_user_date ON daily_plans(user_id, date);

-- Tasks pinned to a daily plan (ordered)
CREATE TABLE daily_plan_items (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    daily_plan_id  UUID NOT NULL REFERENCES daily_plans(id) ON DELETE CASCADE,
    task_id        UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    position       INT NOT NULL DEFAULT 0,
    is_completed   BOOLEAN NOT NULL DEFAULT false,
    UNIQUE(daily_plan_id, task_id)
);
CREATE INDEX idx_daily_plan_items_plan ON daily_plan_items(daily_plan_id);

-- Topic notes
CREATE TABLE topic_notes (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topic_id   UUID NOT NULL,
    title      TEXT NOT NULL DEFAULT '',
    content    TEXT NOT NULL DEFAULT '',
    position   INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (topic_id, user_id) REFERENCES topics(id, user_id) ON DELETE CASCADE
);
CREATE INDEX idx_topic_notes_topic ON topic_notes(topic_id);
CREATE INDEX idx_topic_notes_user ON topic_notes(user_id);

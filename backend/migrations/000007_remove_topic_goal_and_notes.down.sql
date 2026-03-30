ALTER TABLE topics ADD COLUMN goal TEXT NOT NULL DEFAULT '';

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

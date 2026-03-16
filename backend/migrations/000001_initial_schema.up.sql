-- users: foundation table, email/password auth
CREATE TABLE users (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name     TEXT        NOT NULL,
    email         TEXT        NOT NULL,
    password_hash TEXT        NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT users_email_unique UNIQUE (email)
);

-- roadmaps: one per user
CREATE TABLE roadmaps (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT roadmaps_one_per_user UNIQUE (user_id),
    CONSTRAINT roadmaps_id_user UNIQUE (id, user_id)
);

-- stages: UI-only grouping of topics within a roadmap
-- user_id denormalized for composite FK enforcement (cross-user isolation)
CREATE TABLE stages (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    roadmap_id  UUID        NOT NULL,
    user_id     UUID        NOT NULL,
    title       TEXT        NOT NULL,
    position    INT         NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT stages_roadmap_user_fk FOREIGN KEY (roadmap_id, user_id)
        REFERENCES roadmaps(id, user_id) ON DELETE CASCADE,
    CONSTRAINT stages_id_user UNIQUE (id, user_id)
);

CREATE INDEX idx_stages_roadmap_id ON stages (roadmap_id);

-- topics: core learning unit inside a stage
CREATE TYPE topic_status AS ENUM ('not_started', 'in_progress', 'paused', 'completed');

CREATE TABLE topics (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stage_id        UUID            NOT NULL,
    title           TEXT            NOT NULL,
    description     TEXT            NOT NULL DEFAULT '',
    status          topic_status    NOT NULL DEFAULT 'not_started',
    start_date      DATE,
    target_date     DATE,
    completed_date  DATE,
    position        INT             NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    CONSTRAINT topics_stage_user_fk FOREIGN KEY (stage_id, user_id)
        REFERENCES stages(id, user_id) ON DELETE CASCADE,
    CONSTRAINT topics_id_user UNIQUE (id, user_id)
);

CREATE INDEX idx_topics_user_id  ON topics (user_id);
CREATE INDEX idx_topics_stage_id ON topics (stage_id);

-- topic_dependencies: DAG edges (prerequisite relationships)
-- user_id ensures both sides of the dependency belong to the same user
CREATE TABLE topic_dependencies (
    topic_id            UUID NOT NULL,
    depends_on_topic_id UUID NOT NULL,
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (topic_id, depends_on_topic_id),
    CONSTRAINT topic_deps_no_self_ref CHECK (topic_id <> depends_on_topic_id),
    CONSTRAINT topic_deps_topic_fk FOREIGN KEY (topic_id, user_id)
        REFERENCES topics(id, user_id) ON DELETE CASCADE,
    CONSTRAINT topic_deps_depends_on_fk FOREIGN KEY (depends_on_topic_id, user_id)
        REFERENCES topics(id, user_id) ON DELETE CASCADE
);

CREATE INDEX idx_topic_deps_depends_on ON topic_dependencies (depends_on_topic_id);

-- tasks: unified model for standalone tasks and topic checklist items
-- composite FK (topic_id, user_id) → topics: when topic_id IS NULL the FK is not checked (MATCH SIMPLE)
CREATE TYPE task_status AS ENUM ('new', 'in_progress', 'paused', 'done');

CREATE TABLE tasks (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topic_id    UUID,
    title       TEXT        NOT NULL,
    description TEXT        NOT NULL DEFAULT '',
    status      task_status NOT NULL DEFAULT 'new',
    deadline    DATE,
    position    INT         NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT tasks_topic_user_fk FOREIGN KEY (topic_id, user_id)
        REFERENCES topics(id, user_id) ON DELETE CASCADE
);

CREATE INDEX idx_tasks_user_id  ON tasks (user_id);
CREATE INDEX idx_tasks_topic_id ON tasks (topic_id);
CREATE INDEX idx_tasks_deadline ON tasks (user_id, deadline) WHERE deadline IS NOT NULL;

-- materials: learning resources attached to a topic
-- composite FK (topic_id, user_id) → topics: prevents cross-user references
CREATE TABLE materials (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topic_id    UUID        NOT NULL,
    title       TEXT        NOT NULL,
    description TEXT        NOT NULL DEFAULT '',
    progress    INT         NOT NULL DEFAULT 0,
    position    INT         NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT materials_progress_range CHECK (progress >= 0 AND progress <= 100),
    CONSTRAINT materials_topic_user_fk FOREIGN KEY (topic_id, user_id)
        REFERENCES topics(id, user_id) ON DELETE CASCADE
);

CREATE INDEX idx_materials_user_id  ON materials (user_id);
CREATE INDEX idx_materials_topic_id ON materials (topic_id);

-- history_events: technical and business audit log
CREATE TABLE history_events (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entity_type TEXT        NOT NULL,
    entity_id   UUID        NOT NULL,
    event_type  TEXT        NOT NULL,
    event_name  TEXT        NOT NULL,
    payload     JSONB       NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT history_event_type_check CHECK (event_type IN ('technical', 'business'))
);

CREATE INDEX idx_history_user_id    ON history_events (user_id);
CREATE INDEX idx_history_entity     ON history_events (entity_type, entity_id);
CREATE INDEX idx_history_created_at ON history_events (user_id, created_at);

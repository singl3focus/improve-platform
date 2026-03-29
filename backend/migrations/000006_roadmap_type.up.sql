CREATE TYPE roadmap_type AS ENUM ('graph', 'levels', 'cycles');

ALTER TABLE roadmaps
ADD COLUMN type roadmap_type NOT NULL DEFAULT 'graph';

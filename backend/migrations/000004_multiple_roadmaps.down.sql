DROP INDEX IF EXISTS idx_topics_roadmap_id;
ALTER TABLE topics DROP COLUMN roadmap_id;
ALTER TABLE roadmaps ADD CONSTRAINT roadmaps_one_per_user UNIQUE (user_id);

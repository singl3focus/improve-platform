DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM roadmaps
        GROUP BY user_id
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Cannot rollback 000004_multiple_roadmaps: some users already have multiple roadmaps.';
    END IF;
END $$;

DROP INDEX IF EXISTS idx_topics_roadmap_id;
ALTER TABLE topics DROP COLUMN roadmap_id;
ALTER TABLE roadmaps ADD CONSTRAINT roadmaps_one_per_user UNIQUE (user_id);
